"""Offline tests for the coverage_v1 lean engine.

Run: python3 -m execution.test_coverage_v1   (from the repo root)
No network, no Firebase, no paid or subscription inference — the transport
is always a local fake.
"""

import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))

import coverage_v1 as cv  # noqa: E402


# ── Fixtures ─────────────────────────────────────────────────────────────────

SCREENPLAY_TEXT = """\
[PAGE 1]
EL ÚLTIMO PORTERO
written by Ana Márquez

INT. VESTIDOR DEL ESTADIO - NOCHE
DIEGO SALAS (58), portero legendario venido a menos, cuelga sus guantes.
DIEGO
No vuelvo a pisar una cancha. Nunca más.

[PAGE 2]
EXT. BARRIO DE TEPITO - DÍA
Diego encuentra a los NIÑOS DEL BARRIO jugando sin portero.
LUCÍA (12) lo reconoce y lo desafía a parar un penal.
Diego detiene el penal con una sola mano.

[PAGE 3]
INT. CASA DE DIEGO - NOCHE
Diego acepta entrenar al equipo del barrio para el torneo.
DIEGO
Una temporada. Ni un partido más.

[PAGE 4]
EXT. CANCHA LLANERA - DÍA
Montaje de entrenamiento. El equipo pierde su primer partido 5-0.
El patrocinador ROMÁN VEGA amenaza con quitar la cancha al barrio.

[PAGE 5]
INT. HOSPITAL - NOCHE
El médico le dice a Diego que su corazón no soporta otro partido.
Diego decide jugar la final de todos modos.

[PAGE 6]
EXT. ESTADIO DEL TORNEO - DÍA
La final. Lucía anota el gol del empate.
Diego detiene el último penal de la final y se desploma sobre el pasto.
El público ve que Diego detiene el último penal.
Los niños del barrio ganan el torneo y la cancha se salva.
Diego sobrevive y se queda como entrenador.
El público ve que Diego sobrevive y se queda como entrenador.
Diego survives and stays as coach.
Diego sees that he survives and stays as coach.
The audience sees Diego survive and stay as coach.
Diego understands the physical risk.
Diego knows the result.
Diego knows that the result is final.
"""

COSQUILLITAS_SEQUENCE_TEXT = SCREENPLAY_TEXT.replace(
    "[PAGE 3]",
    """[PAGE 3]
Román Vega creates an apparent loss with corrupt scores.
The audience watches as Román Vega creates an apparent loss with corrupt scores.
Román Vega knows the result is false.""",
).replace(
    "[PAGE 4]",
    """[PAGE 4]
Román Vega creates an apparent loss with corrupt scores.
The audience watches as Román Vega creates an apparent loss with corrupt scores.
Román Vega knows the result is false.
Richie receives the wig before the exposé.
The audience sees Richie receive the wig.
Richie knows he received the wig.""",
).replace(
    "[PAGE 5]",
    """[PAGE 5]
Richie chooses Lucesita before the result changes.
The audience sees Richie choose Lucesita.
Richie knows he chose Lucesita.
Richie receives the wig before the exposé.
The audience sees Richie receive the wig.
Richie knows he received the wig.
Diego plays the exposé and overturns the corrupt result.
The audience sees Diego play the exposé and overturn the corrupt result.
Diego knows the corrupt result is overturned.
Diego and the winners celebrate their victory.
The audience sees Diego and the winners celebrate their victory.
Diego knows the contest is over.""",
).replace(
    "[PAGE 6]",
    """[PAGE 6]
Diego plays the exposé and overturns the corrupt result.
The audience sees Diego play the exposé and overturn the corrupt result.
Diego knows the corrupt result is overturned.
Diego and the winners begin their post-climax celebration.
The audience sees Diego and the winners begin their post-climax celebration.
Diego knows the contest is over.
Diego completes the ending with the trophy celebration.
The audience watches as Diego completes the ending with the trophy celebration.
Diego knows the ending is complete.""",
)

FEATURE_STACK = [
    "lemon-coverage", "save-the-cat", "story-grid",
    "comedy-contract", "horror-contract",
]


def settled_usage(cost_microusd: int = 60_000) -> dict:
    return {
        "input_tokens": 40_000,
        "output_tokens": 3_000,
        "cache_creation_input_tokens": 0,
        "cache_read_input_tokens": 0,
        "call_count": 1,
        "actual_cost_microusd": cost_microusd,
        "calls": [
            {
                "usage_accounting_state": "exact_settled_provider_usage",
                "actual_cost_microusd": cost_microusd,
            }
        ],
    }


def uncertain_usage(cost_microusd: int = 90_000) -> dict:
    return {
        "input_tokens": 40_000,
        "output_tokens": 0,
        "cache_creation_input_tokens": 0,
        "cache_read_input_tokens": 0,
        "call_count": 1,
        "actual_cost_microusd": cost_microusd,
        "calls": [
            {
                "usage_accounting_state": (
                    "cap_charge_placeholder_provider_usage_unavailable"
                ),
                "actual_cost_microusd": cost_microusd,
            }
        ],
    }


def valid_coverage(lens_stack=FEATURE_STACK) -> dict:
    return {
        "genre": {
            "primary": "sports drama",
        },
        "logline": (
            "Un portero retirado y enfermo entrena al equipo infantil de "
            "Tepito para salvar la cancha del barrio."
        ),
        "story_spine": {
            "protagonist": "Diego Salas, un portero legendario retirado de 58 años",
            "want": "Salvar la cancha del barrio ganando el torneo",
            "need": "Volver a creer que su vida sirve para algo fuera de la cancha",
            "opposition": "Román Vega, el patrocinador que amenaza con quitar la cancha",
            "stakes": "El barrio pierde su cancha y Diego arriesga su corazón enfermo",
            "major_turns": [
                {"turn": "Lucía desafía a Diego y él detiene el penal", "page": 2},
                {"turn": "El médico le prohíbe jugar; Diego decide jugar la final", "page": 5},
                {"turn": "Diego detiene el último penal y se desploma", "page": 6},
            ],
            "climax": "Diego detiene el último penal de la final y se desploma en el pasto",
            "ending": (
                "Los niños ganan el torneo, la cancha se salva, Diego sobrevive "
                "y se queda como entrenador"
            ),
        },
        "synopsis": (
            "Diego Salas, portero legendario venido a menos, jura no volver a "
            "pisar una cancha. Los niños de Tepito, encabezados por Lucía, lo "
            "arrastran de regreso al fútbol llanero. Cuando el patrocinador "
            "Román Vega amenaza con quitarle la cancha al barrio, Diego acepta "
            "entrenar al equipo para el torneo, desafiando el diagnóstico de su "
            "corazón enfermo, hasta detener el último penal de la final."
        ),
        "lens_notes": [
            {
                "lens": lens,
                "grade": "solid",
                "analysis": (
                    "Bajo esta lente el guion sostiene su promesa central con "
                    "una progresión clara de complicaciones y un clímax ganado "
                    "en la cancha, aunque el segundo acto repite beats."
                ),
                "page": 2,
                "excerpt": "detiene el penal con una sola mano",
            }
            for lens in lens_stack
        ],
        "genre_contract": {
            "contract": (
                "Drama deportivo: el partido final debe ganarse con costo "
                "emocional real en la cancha"
            ),
            "met": True,
            "failures": [],
        },
        "strengths": [
            {
                "point": "El desafío de Lucía en Tepito ancla la premisa con imagen y acción",
                "page": 2,
                "excerpt": "lo reconoce y lo desafía a parar un penal",
            },
            {
                "point": "El diagnóstico médico convierte la final en una decisión de vida o muerte",
                "page": 5,
                "excerpt": "su corazón no soporta otro partido",
            },
            {
                "point": "El clímax paga la promesa del deporte y del personaje a la vez",
                "page": 6,
                "excerpt": "Lucía anota el gol del empate",
            },
        ],
        "concerns": [
            {
                "point": "El antagonista Román Vega es funcional pero unidimensional",
                "page": 4,
                "excerpt": "amenaza con quitar la cancha",
            },
            {
                "point": "El montaje de entrenamiento comprime demasiado la derrota 5-0",
                "page": 4,
                "excerpt": "pierde su primer partido",
            },
            {
                "point": "La recuperación de Diego tras el desplome se resuelve sin costo",
                "page": 6,
                "excerpt": "Diego sobrevive y se queda",
            },
        ],
        "development_priorities": [
            {
                "priority": "Darle a Román Vega una motivación personal legítima",
                "why": "Un antagonista con razones eleva cada enfrentamiento del torneo",
                "how": "Una escena donde Vega revele qué perdió él en esa misma cancha",
            },
            {
                "priority": "Expandir la derrota 5-0 en secuencia dramatizada",
                "why": "La caída necesita doler para que la final pague",
                "how": "Convertir el montaje de la página 4 en dos escenas con beats de humillación",
            },
            {
                "priority": "Cobrar un precio real por la decisión médica de Diego",
                "why": "El desenlace actual perdona la apuesta de vida sin consecuencia",
                "how": "Que Diego sobreviva pero no pueda volver a parar un penal él mismo",
            },
        ],
        "verdict": "CONSIDER",
        "confidence": "high",
        "champion_reason": (
            "Un vehículo deportivo familiar mexicano con corazón genuino y un "
            "clímax que paga premisa y arco a la vez"
        ),
        "pass_reason": (
            "La fórmula es reconocible y el antagonista no sostiene todavía "
            "una película completa"
        ),
        "uncertainties": ["La edad exacta del público objetivo no está clara"],
        "continuity_flags": [],
        "commercial_hypothesis": (
            "Familias mexicanas y público de fútbol; comps Rudo y Cursi, "
            "McFarland USA; drama deportivo familiar de barrio para estreno "
            "teatral local"
        ),
    }


def supported_audit(coverage: dict) -> dict:
    claims = cv.build_audit_claims(coverage)
    last_page = max(
        turn["page"]
        for turn in coverage["story_spine"]["major_turns"]
    )
    result = {
        "verdicts": [
            {
                "claim_id": claim["claim_id"],
                "classification": "supported",
                "note": "Confirmado en el texto.",
            }
            for claim in claims
        ],
        "existing_evidence_verdicts": [
            {
                "field_path": check["field_path"],
                "classification": "supported",
                "note": "The full-screenplay check found no contradiction.",
            }
            for check in cv.build_existing_evidence_checks(
                coverage, SCREENPLAY_TEXT
            )
        ],
        "sequence_ledger": [
            {
                "order": 1,
                "phase": "climax",
                "actor": "Diego",
                "action": coverage["story_spine"]["climax"],
                "result": "Diego se desploma sobre el pasto.",
                "character_knowledge": "Diego understands the physical risk.",
                "audience_knowledge": (
                    "El público ve que Diego detiene el último penal."
                ),
                "page": last_page,
            },
            {
                "order": 2,
                "phase": "ending",
                "actor": "Diego",
                "action": "Diego sobrevive y se queda como entrenador.",
                "result": "Diego sobrevive y se queda como entrenador.",
                "character_knowledge": "Diego knows the result.",
                "audience_knowledge": (
                    "El público ve que Diego sobrevive y se queda como entrenador."
                ),
                "page": last_page,
            },
            {
                "order": 3,
                "phase": "final_scene",
                "actor": "Diego",
                "action": "Diego sobrevive y se queda como entrenador.",
                "result": "Diego sobrevive y se queda como entrenador.",
                "character_knowledge": "Diego knows the result.",
                "audience_knowledge": (
                    "El público ve que Diego sobrevive y se queda como entrenador."
                ),
                "page": last_page,
            },
            {
                "order": 4,
                "phase": "tag",
                "actor": "NOT PRESENT",
                "action": "NOT PRESENT",
                "result": "NOT PRESENT",
                "character_knowledge": "NOT PRESENT",
                "audience_knowledge": "NOT PRESENT",
                "page": last_page,
            },
            {
                "order": 5,
                "phase": "aftermath",
                "actor": "Diego",
                "action": "Diego sobrevive y se queda como entrenador.",
                "result": "Diego sobrevive y se queda como entrenador.",
                "character_knowledge": "Diego knows the result.",
                "audience_knowledge": (
                    "El público ve que Diego sobrevive y se queda como entrenador."
                ),
                "page": last_page,
            },
        ],
        "citation_relevance": [
            {
                "owner": owner,
                "classification": "supported",
                "note": "The excerpt directly supports its attached claim.",
                "checks": [{
                    "field": "citation",
                    "page": item["page"],
                    "excerpt": item["excerpt"],
                    "supports": True,
                }],
                "claim_sha256": cv.canonical_json_hash({
                    "owner": owner,
                    "page": item["page"],
                    "excerpt": item["excerpt"],
                    "claim_span": cv._citation_claim_span(item),
                }),
                "grounding_valid": True,
            }
            for owner, item in cv._iter_citations(coverage)
        ],
    }
    result["sequence_evidence"] = [
        {
            "field_path": f"sequence_ledger[{beat['order']}]",
            "classification": "supported",
            "note": "The source grounds every required sequence field.",
            "checks": [],
            "claim_sha256": cv.canonical_json_hash({
                field: beat.get(field)
                for field in (
                    "order", "phase", "page", *cv.GROUNDED_SEQUENCE_FIELDS,
                )
            }),
            "grounding_valid": True,
        }
        for beat in result["sequence_ledger"]
        if beat["action"] != "NOT PRESENT"
    ]
    return result


def provider_audit_core(coverage: dict) -> dict:
    """Provider shape: exact sequence phase keys; details use a second tool."""
    audit = supported_audit(coverage)
    sequence = {
        phase: []
        for phase in ("climax", "ending", "final_scene", "tag", "aftermath")
    }
    for row in audit["sequence_ledger"]:
        sequence[row["phase"]].append({
            key: value
            for key, value in row.items()
            if key not in {"order", "phase"}
        })
    return {
        "verdicts": audit["verdicts"],
        "sequence_ledger": sequence,
    }


def ground_final_scene_for_test(core: dict) -> None:
    row = core["sequence_ledger"]["final_scene"][0]
    row["action"] = "Diego sees that he survives and stays as coach."
    row["result"] = "Diego survives and stays as coach."
    row["audience_knowledge"] = (
        "The audience sees Diego survive and stay as coach."
    )


def ground_sequence_row_for_test(
    row: dict,
    *,
    page: int,
    actor: str,
    action: str,
    knowledge: str,
    audience: str,
) -> None:
    row.update({
        "page": page,
        "actor": actor,
        "action": action,
        "result": action,
        "character_knowledge": knowledge,
        "audience_knowledge": audience,
    })


def sequence_source_token(
    check: dict,
    row: dict,
    field: str,
    text: str,
) -> str:
    if not check["supports"]:
        return cv.SEQUENCE_SOURCE_NOT_LOCATED
    wanted = cv._fold_evidence_text(str(check["excerpt"]))
    candidates = [
        (source_id, cv._fold_evidence_text(str(anchor["excerpt"])))
        for source_id, anchor in cv._source_anchor_catalog(text).items()
        if anchor["page"] == check["page"]
    ]
    beat = row["subject"]["beat"]
    if field == "actor":
        candidates = [
            candidate for candidate in candidates
            if cv._sequence_anchor_actor_reason(
                beat, field, candidate[1]
            ) is None
        ]
        action_terms = cv._sequence_content_terms(
            str(beat.get("action", "")), str(beat.get("actor", ""))
        )
        if candidates and action_terms:
            scored = [
                (
                    len(
                        cv._sequence_content_terms(
                            excerpt, str(beat.get("actor", ""))
                        )
                        & action_terms
                    ),
                    source_id,
                    excerpt,
                )
                for source_id, excerpt in candidates
            ]
            best = max(score for score, _source_id, _excerpt in scored)
            if best:
                candidates = [
                    (source_id, excerpt)
                    for score, source_id, excerpt in scored
                    if score == best
                ]
    elif field == "character_knowledge":
        candidates = [
            candidate for candidate in candidates
            if cv._SEQUENCE_EXPLICIT_KNOWLEDGE_VERB.search(candidate[1])
            and cv._sequence_subject_matches_context(
                str(beat[field]), candidate[1], knowledge=True
            )
            and cv._sequence_atomic_fact_matches(
                cv._sequence_knowledge_fact(str(beat[field])),
                cv._sequence_knowledge_fact(candidate[1]),
            )
        ]
    else:
        if field == "audience_knowledge":
            candidates = [
                candidate for candidate in candidates
                if cv._sequence_audience_source_predicate(candidate[1])
            ]
        else:
            direct_candidates = [
                candidate for candidate in candidates
                if not cv._sequence_audience_source_predicate(candidate[1])
            ]
            candidates = direct_candidates or candidates
            literal_candidates = [
                candidate for candidate in candidates
                if cv._sequence_literal_fragment_matches(
                    str(beat.get(field, "")), candidate[1]
                )
            ]
            candidates = literal_candidates or candidates
        actor_names = [
            cv._fold_evidence_text(name)
            for name in cv._sequence_named_actors(
                str(beat.get("actor", ""))
            )
        ]
        if field == "action" and actor_names:
            actor_candidates = [
                candidate for candidate in candidates
                if any(name in candidate[1] for name in actor_names)
            ]
            if actor_candidates:
                agent_candidates = [
                    candidate for candidate in actor_candidates
                    if cv._sequence_anchor_actor_reason(
                        beat, field, candidate[1]
                    ) is None
                ]
                candidates = agent_candidates or actor_candidates
        scored = [
            (
                len(cv._sequence_field_relevance_terms(
                    beat, field, excerpt
                )),
                source_id,
                excerpt,
            )
            for source_id, excerpt in candidates
        ]
        minimum = 2 if field == "action" else 1
        candidates = [
            (source_id, excerpt)
            for score, source_id, excerpt in sorted(scored, reverse=True)
            if score >= minimum
        ]
    if not candidates:
        return cv.SEQUENCE_SOURCE_NOT_LOCATED
    anchor_id = next((
        source_id for source_id, excerpt in candidates
        if wanted == excerpt or wanted in excerpt or excerpt in wanted
    ), candidates[0][0])
    return f"{row['slot']}:{field}:{anchor_id}"


def grounded_detail_value(row: dict, text: str = SCREENPLAY_TEXT) -> str:
    subject = row["subject"]
    if row["kind"] == "citation_relevance":
        checks = [{
            "field": "citation",
            "page": subject["page"],
            "excerpt": subject["excerpt"],
            "supports": True,
        }]
    else:
        beat = subject["beat"]
        _numbers, pages = cv._marked_page_contents(text)
        page_text = pages[beat["page"]]

        def excerpt_for(names: list[str]) -> str:
            for line in page_text.splitlines():
                words = line.split()
                if (
                    3 <= len(words) <= 12
                    and all(
                        cv._fold_evidence_text(name)
                        in cv._fold_evidence_text(line)
                        for name in names
                    )
                ):
                    return " ".join(words)
            for line in page_text.splitlines():
                words = line.split()
                if 3 <= len(words) <= 12 and not line.isupper():
                    return " ".join(words)
            return " ".join(page_text.split()[:5])

        claimed_actors = cv._sequence_named_actors(
            str(beat.get("actor", ""))
        )
        claimed_knowers = cv._sequence_claimed_knowers(
            str(beat.get("character_knowledge", ""))
        )
        actor_excerpt = excerpt_for(claimed_actors)
        knowledge_excerpt = excerpt_for(claimed_knowers)
        raw_checks = [
            {
                "field": field,
                "page": beat["page"],
                "excerpt": actor_excerpt
                if field == "actor"
                else knowledge_excerpt
                if field == "character_knowledge"
                else excerpt_for([]),
                "supports": True,
            }
            for field in subject["required_fields"]
        ]
        checks = []
        for check in raw_checks:
            source_id = sequence_source_token(
                check, row, check["field"], text
            )
            checks.append({
                "field": check["field"],
                "source_id": source_id,
                "supports": source_id != cv.SEQUENCE_SOURCE_NOT_LOCATED,
            })
    located = [check["supports"] for check in checks]
    value = {
        "classification": (
            "supported" if all(located)
            else "partially_supported" if any(located)
            else "unsupported"
        ),
        "checks": checks,
        "note": "Each decision is bound to a field-local source result.",
    }
    if row["kind"] == "sequence_evidence":
        _decoded, reason = cv._decode_grounded_detail_value(
            value, row, text
        )
        if reason is not None:
            value = {
                "classification": "unsupported",
                "checks": [
                    {
                        "field": check["field"],
                        "source_id": cv.SEQUENCE_SOURCE_NOT_LOCATED,
                        "supports": False,
                    }
                    for check in checks
                ],
                "note": "The synthetic fixture cannot locate this beat.",
            }
    return json.dumps(value)


def supported_detail_payload(
    coverage: dict,
    audit: dict | None = None,
    text: str = SCREENPLAY_TEXT,
) -> dict:
    evidence = cv.build_existing_evidence_checks(coverage, text)
    sequence = (audit or supported_audit(coverage))["sequence_ledger"]
    rows = cv.build_detail_audit_rows(coverage, evidence, sequence)
    return detail_payload_for_rows(rows, text)


def detail_payload_for_rows(
    rows: list[dict], text: str = SCREENPLAY_TEXT,
) -> dict:
    values = {
        row["slot"]: (
            grounded_detail_value(row, text)
            if row["kind"] in {
                "citation_relevance", "sequence_evidence",
            }
            else "supported: Confirmed against the screenplay."
        )
        for row in rows
    }
    overflow_slots = cv._detail_overflow_slots(rows)
    if not overflow_slots:
        return {"results": values}
    return {
        "results": {
            **{
                slot: value for slot, value in values.items()
                if slot not in overflow_slots
            },
            "overflow_json": json.dumps({
                slot: values[slot] for slot in overflow_slots
            }),
        }
    }


def typed_detail_payload_for_rows(
    rows: list[dict], text: str = SCREENPLAY_TEXT,
) -> dict:
    """Provider-shaped typed detail arrays for strict transport tests."""
    payload: dict[str, list[dict]] = {}

    for row in rows:
        subject = row.get("subject", {})
        if row["kind"] == "citation_relevance":
            group = "citation_results"
            grounded = json.loads(grounded_detail_value(row, text))
            value = {
                "supports": grounded["checks"][0]["supports"],
                "note": grounded["note"],
            }
        elif row["kind"] == "sequence_evidence":
            group = cv._detail_result_group(row)
            grounded = json.loads(grounded_detail_value(row, text))
            checks = {
                check["field"]: check for check in grounded["checks"]
            }
            source_tokens = {
                field: checks[field]["source_id"]
                for field in subject["required_fields"]
            }
            located = [
                token != cv.SEQUENCE_SOURCE_NOT_LOCATED
                for token in source_tokens.values()
            ]
            value = {
                "classification": (
                    "supported" if all(located)
                    else "partially_supported" if any(located)
                    else "unsupported"
                ),
                "note": grounded["note"],
                "character_knowledge_status": (
                    "checked"
                    if "character_knowledge" in subject["required_fields"]
                    else "not_required"
                ),
                **{
                    f"{field}_source_id": token
                    for field, token in source_tokens.items()
                },
            }
        elif subject.get("trigger") == "counting_claim":
            group = "count_results"
            value = {
                "instances": [],
            }
        elif subject.get("focused_evidence"):
            group = "focused_results"
            value = {
                "classification": "partially_supported",
                "note": "The supplied windows were reviewed separately.",
                "reviewed_roles": cv._focused_role_tokens(subject),
                "source_status": "inferable",
                "activation_status": "unconfirmed",
            }
        else:
            group = "text_results"
            value = {
                "classification": "supported",
                "note": "Confirmed against the complete screenplay.",
            }
        payload.setdefault(group, []).append({"slot": row["slot"], **value})
    return payload


def completed_audit_fixture(
    coverage: dict, audit: dict, text: str = SCREENPLAY_TEXT,
) -> dict:
    rows = cv.build_detail_audit_rows(
        coverage,
        cv.build_existing_evidence_checks(coverage, text),
        audit["sequence_ledger"],
    )
    evidence, citations = cv.decode_detail_audit_payload(
        supported_detail_payload(coverage, audit, text), rows, text
    )
    return cv._replace_audit_details(audit, evidence, citations)


def pending_reaudit_detail_payload(
    prior_coverage: dict,
    prior_audit: dict,
    current_coverage: dict,
    sequence_ledger: list[dict],
    text: str = SCREENPLAY_TEXT,
) -> dict:
    current_rows = cv.build_detail_audit_rows(
        current_coverage,
        cv.build_existing_evidence_checks(current_coverage, text),
        sequence_ledger,
    )
    _evidence, _citations, pending = cv._reusable_detail_seed(
        prior_coverage,
        cv.build_existing_evidence_checks(prior_coverage, text),
        prior_audit,
        current_rows,
    )
    return detail_payload_for_rows(pending, text)


class FakeTransport:
    """Scripted transport. Each entry: (tool_input, usage) or an Exception."""

    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def __call__(self, **kwargs):
        self.calls.append(kwargs)
        if not self.responses:
            raise AssertionError("FakeTransport exhausted — unexpected extra call")
        item = self.responses.pop(0)
        if isinstance(item, Exception):
            item.proven_no_spend = True
            raise item
        tool_input, usage = item
        return copy.deepcopy(tool_input), "", copy.deepcopy(usage)


def run_engine(store, transport, **overrides):
    kwargs = dict(
        text=SCREENPLAY_TEXT,
        title="El Último Portero",
        page_count=6,
        word_count=380,
        content_sha256="a" * 64,
        parser_version="v5-scene-content-evidence",
        checkpoint_store=store,
        fmt="feature",
        transport=transport,
        max_cost_usd=1.0,
    )
    kwargs.update(overrides)
    return cv.run_coverage_v1(**kwargs)


def new_store():
    return cv.LocalCheckpointStore(Path(tempfile.mkdtemp()) / "cv1")


def screenplay_with_printed_headers() -> str:
    """The fixture screenplay re-laid-out like a real PDF with a title page:
    physical page N+1 carries printed header number N, so printed = physical - 1.
    Fixture content lands on the same PRINTED page it occupied before, and
    filler pages push header detections past the confidence minimum."""
    _numbers, pages = cv._marked_page_contents(SCREENPLAY_TEXT)
    parts = ["[PAGE 1]", "EL ÚLTIMO PORTERO", "escrito por Ana Márquez", ""]
    for printed in range(1, 13):
        content = pages.get(
            printed, "Página de relleno sin citas relevantes en la trama."
        )
        parts += [f"[PAGE {printed + 1}]", f"{printed}.", content, ""]
    return "\n".join(parts)


# ── Tests ────────────────────────────────────────────────────────────────────

class TestSchemas(unittest.TestCase):
    def test_all_schemas_within_strict_compiler_budget(self):
        cv.assert_schemas_compiler_safe()

    def test_budget_actually_binds(self):
        bloated = copy.deepcopy(cv.COVERAGE_TOOL)
        for i in range(60):
            bloated["input_schema"]["properties"][f"extra_{i}"] = {"type": "string"}
        stats = cv.strict_schema_complexity(bloated["input_schema"])
        self.assertGreater(
            stats["property_count"], cv.STRICT_BUDGET["property_count"]
        )


class TestLensRegistry(unittest.TestCase):
    def setUp(self):
        self.registry = cv.load_lens_registry()

    def test_registry_loads_and_cards_exist(self):
        self.assertIn("lemon-coverage", self.registry["lenses"])
        self.assertIn("grisanti-pilot", self.registry["lenses"])

    def test_feature_default_without_genre_includes_both_contracts(self):
        stack = cv.resolve_lens_stack(self.registry, "feature")
        self.assertIn("lemon-coverage", stack)
        self.assertIn("horror-contract", stack)
        self.assertIn("comedy-contract", stack)
        self.assertLessEqual(len(stack), cv.MAX_LENSES_PER_RUN)

    def test_horror_hint_selects_only_horror_contract(self):
        stack = cv.resolve_lens_stack(self.registry, "feature", genre_hint="horror")
        self.assertIn("horror-contract", stack)
        self.assertNotIn("comedy-contract", stack)

    def test_tv_pilot_defaults_to_grisanti(self):
        stack = cv.resolve_lens_stack(self.registry, "tv_pilot")
        self.assertEqual(stack[0], "grisanti-pilot")
        self.assertIn("grisanti-series", stack)

    def test_explicit_request_wins_and_unknown_is_rejected(self):
        stack = cv.resolve_lens_stack(
            self.registry, "feature", requested=["truby", "enneagram"]
        )
        self.assertEqual(stack, ["truby", "enneagram"])
        with self.assertRaises(cv.LensConfigurationError):
            cv.resolve_lens_stack(self.registry, "feature", requested=["nope"])

    def test_oversized_stack_is_rejected(self):
        many = list(self.registry["lenses"])[: cv.MAX_LENSES_PER_RUN + 1]
        with self.assertRaises(cv.LensConfigurationError):
            cv.resolve_lens_stack(self.registry, "feature", requested=many)

    def test_all_cards_fit_byte_budget(self):
        for lens_id, entry in self.registry["lenses"].items():
            card = cv.LENSES_ROOT / entry["card"]
            self.assertTrue(card.is_file(), f"{lens_id} card missing")
            self.assertLessEqual(
                card.stat().st_size, cv.MAX_LENS_CARD_BYTES, lens_id
            )


class TestPrintedPageNumbering(unittest.TestCase):
    # Hermanos brief, recurring 2: one deterministic page convention,
    # detected in code, never the model's guess.

    def test_offset_detected_and_markers_renumbered(self):
        text = screenplay_with_printed_headers()
        info = cv._detect_printed_page_offset(text)
        self.assertIsNotNone(info)
        self.assertEqual(info["offset"], -1)
        renumbered = cv._renumber_page_markers(text, -1)
        self.assertIn("[UNNUMBERED FRONT MATTER]", renumbered)
        _numbers, pages = cv._marked_page_contents(renumbered)
        self.assertEqual(min(pages), 1)
        # Content is addressable by its PRINTED page after renumbering.
        self.assertIn("su corazón no soporta otro partido", pages[5])

    def test_report_cites_printed_pages_end_to_end(self):
        coverage = valid_coverage()
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (supported_audit(coverage), settled_usage()),
            ]
        )
        report, _usage = run_engine(
            new_store(),
            transport,
            text=screenplay_with_printed_headers(),
            page_count=13,
        )
        self.assertEqual(report["status"], "sealed")
        self.assertEqual(report["page_numbering"]["mode"], "printed")
        self.assertEqual(report["page_numbering"]["offset"], -1)
        self.assertIn("PRINTED", report["page_convention"])
        # The fixture's printed-page citations verify against the
        # renumbered text with zero relocations needed.
        self.assertEqual(report["citation_verification"]["unverified"], 0)
        self.assertFalse(report["human_review_recommended"])

    def test_typed_page_reference_mapping_preserves_each_identity(self):
        coverage = valid_coverage()
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (supported_audit(coverage), settled_usage()),
            ]
        )
        report, _usage = run_engine(
            new_store(),
            transport,
            text=screenplay_with_printed_headers(),
            page_count=13,
        )

        self.assertEqual(report["physical_page_count"], 13)
        self.assertEqual(report["printed_page_count"], 12)
        self.assertEqual(report["page_count"], 12)
        first_body_page = report["page_reference_map"][1]
        self.assertEqual(first_body_page["pdf_page"], 2)
        self.assertEqual(first_body_page["printed_page"], 1)
        self.assertEqual(first_body_page["citation_page"], 1)
        self.assertEqual(first_body_page["scene_numbers"], [])
        page_two = report["page_reference_map"][2]
        self.assertEqual(page_two["pdf_page"], 3)
        self.assertEqual(page_two["printed_page"], 2)
        self.assertIn("page_map_sha256", report["page_numbering"])

    def test_terapia_impossible_page_is_rejected_before_audit(self):
        impossible = valid_coverage()
        impossible["story_spine"]["major_turns"][1]["page"] = 109
        fixed = valid_coverage()
        numbered_text = SCREENPLAY_TEXT.replace(
            "INT. HOSPITAL - NOCHE",
            "109. INT. HOSPITAL - NOCHE",
        )
        transport = FakeTransport(
            [
                (impossible, settled_usage()),
                (fixed, settled_usage()),
                (supported_audit(fixed), settled_usage()),
            ]
        )

        report, _usage = run_engine(
            new_store(), transport, text=numbered_text
        )

        self.assertEqual(report["status"], "sealed")
        self.assertIn("109", report["page_reference_map"][4]["scene_numbers"])
        self.assertTrue(
            any(
                "story_spine.major_turns[1].page" in problem
                and "scene number 109" in problem
                for problem in report["diagnostics"][
                    "coverage_first_pass_problems"
                ]
            )
        )

    def test_terapia_impossible_page_in_prose_is_rejected(self):
        coverage = valid_coverage()
        coverage["lens_notes"][0]["analysis"] += (
            " La decisión queda confirmada en las páginas 104-109."
        )
        page_map = cv.build_page_reference_map(SCREENPLAY_TEXT, 6, None)

        problems = cv.validate_coverage_payload(
            coverage, FEATURE_STACK, page_map
        )

        self.assertTrue(
            any(
                "lens_notes[0].analysis" in problem
                and "page 104" in problem
                for problem in problems
            )
        )

    def test_terapia_impossible_page_in_page_list_is_rejected(self):
        coverage = valid_coverage()
        coverage["lens_notes"][0]["analysis"] += (
            " Los hechos aparecen en las páginas 2, 109 y 5."
        )
        page_map = cv.build_page_reference_map(SCREENPLAY_TEXT, 6, None)

        problems = cv.validate_coverage_payload(
            coverage, FEATURE_STACK, page_map
        )

        self.assertTrue(any("page 109" in problem for problem in problems))

    def test_unnumbered_document_falls_back_to_physical(self):
        self.assertIsNone(cv._detect_printed_page_offset(SCREENPLAY_TEXT))
        coverage = valid_coverage()
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (supported_audit(coverage), settled_usage()),
            ]
        )
        report, _usage = run_engine(new_store(), transport)
        self.assertEqual(report["page_numbering"]["mode"], "physical")
        self.assertIn("physical", report["page_convention"])
        self.assertIsNone(report["page_reference_map"][0]["printed_page"])
        self.assertEqual(report["page_reference_map"][0]["citation_page"], 1)
        self.assertEqual(report["printed_page_count"], 0)
        self.assertEqual(report["page_count"], 6)


class TestHappyPath(unittest.TestCase):
    def test_two_calls_seal_a_report(self):
        coverage = valid_coverage()
        transport = FakeTransport(
            [
                (coverage, settled_usage(200_000)),
                (supported_audit(coverage), settled_usage(80_000)),
            ]
        )
        report, usage = run_engine(new_store(), transport)

        self.assertEqual(len(transport.calls), 2)
        self.assertEqual(report["status"], "sealed")
        self.assertEqual(report["verdict"], "CONSIDER")
        self.assertFalse(report["human_review_recommended"])
        self.assertEqual(report["cost"]["repair_calls_used"], 0)
        self.assertEqual(usage["call_count"], 2)
        self.assertEqual(report["fact_audit"]["support_rate"], 1.0)
        self.assertEqual(len(report["coverage"]["development_priorities"]), 3)
        # Spanish text and Unicode survive the round trip.
        self.assertIn("Tepito", report["coverage"]["synopsis"])
        self.assertIn("Márquez", SCREENPLAY_TEXT)

    def test_citation_verification_flags_fabricated_quotes(self):
        coverage = valid_coverage()
        coverage["strengths"][0]["excerpt"] = (
            "esta cita no existe en ninguna página"
        )
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (coverage, settled_usage()),
                (supported_audit(coverage), settled_usage()),
            ]
        )
        report, _usage = run_engine(new_store(), transport)
        summary = report["citation_verification"]
        self.assertEqual(summary["unverified"], 1)
        flagged = report["coverage"]["strengths"][0]
        self.assertFalse(flagged["citation_verified"])
        verified = report["coverage"]["strengths"][1]
        self.assertTrue(verified["citation_verified"])

    def test_wrong_page_with_unique_verbatim_quote_is_relocated(self):
        coverage = valid_coverage()
        # Quote is verbatim from page 5, but the reader cited page 3.
        coverage["strengths"][1]["page"] = 3
        relocated = copy.deepcopy(coverage)
        cv.verify_citations(relocated, SCREENPLAY_TEXT)
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (supported_audit(relocated), settled_usage()),
            ]
        )
        report, _usage = run_engine(new_store(), transport)
        summary = report["citation_verification"]
        self.assertEqual(summary["unverified"], 0)
        self.assertEqual(summary["relocated"], 1)
        fixed = report["coverage"]["strengths"][1]
        self.assertEqual(fixed["page"], 5)
        self.assertEqual(fixed["cited_page"], 3)
        self.assertTrue(fixed["citation_match_kind"].startswith("relocated_"))

    def test_slash_marked_line_break_verifies_on_the_cited_page(self):
        # Canary 2026-08-31 near-miss pattern 1: the model inserts " / " to
        # mark a screenplay line break inside an otherwise verbatim quote.
        coverage = valid_coverage()
        coverage["strengths"][1]["excerpt"] = (
            "su corazón no / soporta otro partido"
        )
        summary = cv.verify_citations(coverage, SCREENPLAY_TEXT)
        self.assertEqual(summary["unverified"], 0)
        item = coverage["strengths"][1]
        self.assertTrue(item["citation_verified"])
        self.assertIn("slash_normalized", item["citation_match_kind"])

    def test_slash_marked_quote_on_wrong_page_is_relocated(self):
        # Canary pattern 1 + 2 combined (the three Hermanos failures): a
        # slashed line break AND an off-by-one page. The slash used to block
        # the relocation rescue as well.
        coverage = valid_coverage()
        coverage["strengths"][1]["excerpt"] = (
            "su corazón no / soporta otro partido"
        )
        coverage["strengths"][1]["page"] = 3
        summary = cv.verify_citations(coverage, SCREENPLAY_TEXT)
        self.assertEqual(summary["unverified"], 0)
        self.assertEqual(summary["relocated"], 1)
        item = coverage["strengths"][1]
        self.assertEqual(item["page"], 5)
        self.assertEqual(item["cited_page"], 3)
        self.assertTrue(item["citation_match_kind"].startswith("relocated_"))
        self.assertIn("slash_normalized", item["citation_match_kind"])

    def test_invented_leading_word_stays_unverified_when_long(self):
        for invented_word in ("Un", "Falsa"):
            with self.subTest(invented_word=invented_word):
                coverage = valid_coverage()
                excerpt = (
                    f"{invented_word} médico le dice a Diego que su corazón "
                    "no soporta"
                )
                coverage["strengths"][1]["excerpt"] = excerpt

                summary = cv.verify_citations(coverage, SCREENPLAY_TEXT)

                self.assertEqual(summary["unverified"], 1)
                item = coverage["strengths"][1]
                self.assertFalse(item["citation_verified"])
                self.assertEqual(item["excerpt"], excerpt)

    def test_cosquillitas_invented_trailing_word_stays_unverified(self):
        screenplay = "[PAGE 73]\nVemos una pequeña cámara.\n"
        for invented_word in ("escondida", "falsa"):
            with self.subTest(invented_word=invented_word):
                excerpt = f"vemos una pequeña cámara {invented_word}"
                coverage = {
                    "lens_notes": [],
                    "strengths": [
                        {
                            "point": "La cámara prepara el video del final",
                            "page": 73,
                            "excerpt": excerpt,
                        }
                    ],
                    "concerns": [],
                }

                summary = cv.verify_citations(coverage, screenplay)

                self.assertEqual(summary["unverified"], 1)
                citation = coverage["strengths"][0]
                self.assertEqual(citation["excerpt"], excerpt)
                self.assertNotIn("cited_excerpt", citation)

    def test_wrong_edge_punctuation_verifies(self):
        # Re-canary 2026-09-01: the model wrote '¡Quién...' for the text's
        # '¿Quién...' — edge punctuation must not fail a verbatim quote.
        kind = cv._lenient_excerpt_match_kind(
            "JAIME grita al micrófono: ¿Quién. Es. Más. Macho? Nadie sabe.",
            "¡Quién. Es. Más. Macho?",
        )
        self.assertIsNotNone(kind)
        self.assertIn("edge_punct_stripped", kind)

    def test_curly_quotes_unicode_ellipsis_and_whitespace_normalize(self):
        kind = cv._lenient_excerpt_match_kind(
            'MIMO dice: “No… abras\n  todavía esa puerta.”',
            '"No... abras todavía esa puerta."',
        )
        self.assertIsNotNone(kind)
        self.assertIn("revision_safe", kind)

    def test_quote_stitched_across_speakers_stays_flagged(self):
        # Policy: a sentence assembled from two characters' half-lines is not
        # a verbatim quote — it must remain unverified (and flag review).
        kind = cv._lenient_excerpt_match_kind(
            "IKER Solo un retrasado mental. ABEL ...Dedicaría su día a "
            "escuchar las vidas de completos extraños.",
            "Solo un retrasado mental dedicaría su día a escuchar",
        )
        self.assertIsNone(kind)

    def test_invented_leading_word_stays_unverified_when_short(self):
        coverage = valid_coverage()
        coverage["strengths"][1]["excerpt"] = "mal corazón no soporta"
        summary = cv.verify_citations(coverage, SCREENPLAY_TEXT)
        self.assertEqual(summary["unverified"], 1)
        self.assertFalse(coverage["strengths"][1]["citation_verified"])

    def test_diablo_revision_marks_and_line_end_hyphen_verify(self):
        coverage = {
            "lens_notes": [],
            "strengths": [
                {
                    "point": "La deuda del personaje está planteada",
                    "page": 1,
                    "excerpt": "Porque ellas no son las adictas al juego",
                }
            ],
            "concerns": [],
        }
        revised_page = """\
[PAGE 1]
Porque ellas no son las adic-                              *
*
tas al juego.
"""

        summary = cv.verify_citations(coverage, revised_page)

        self.assertEqual(summary["unverified"], 0)
        self.assertEqual(summary["text_verified"], 1)
        self.assertEqual(summary["page_verified"], 1)
        citation = coverage["strengths"][0]
        self.assertTrue(citation["citation_text_verified"])
        self.assertTrue(citation["citation_page_verified"])
        self.assertIn("layout_normalized", citation["citation_match_kind"])

    def test_repeated_quote_proves_text_but_not_wrong_page(self):
        coverage = {
            "lens_notes": [],
            "strengths": [
                {
                    "point": "A repeated warning is used twice",
                    "page": 3,
                    "excerpt": "No abras esa puerta todavía",
                }
            ],
            "concerns": [],
        }
        screenplay = """\
[PAGE 1]
No abras esa puerta todavía.
[PAGE 2]
No abras esa puerta todavía.
[PAGE 3]
La puerta permanece cerrada.
"""

        summary = cv.verify_citations(coverage, screenplay)

        citation = coverage["strengths"][0]
        self.assertEqual(summary["text_verified"], 1)
        self.assertEqual(summary["page_verified"], 0)
        self.assertEqual(summary["unverified"], 1)
        self.assertTrue(citation["citation_text_verified"])
        self.assertFalse(citation["citation_page_verified"])
        self.assertNotIn("cited_page", citation)

    def test_citation_relevance_is_a_separate_seal_gate(self):
        coverage = valid_coverage()
        audit = supported_audit(coverage)
        for row in audit["verdicts"]:
            if row["claim_id"] == "guard.citation_relevance":
                row["classification"] = "contradicted"
                row["note"] = "The quote exists but does not support concern 2."
        audit["citation_relevance"][0]["classification"] = "contradicted"
        audit["citation_relevance"][0]["note"] = (
            "The quote exists but does not support its attached claim."
        )
        transport = FakeTransport(
            [(coverage, settled_usage()), (audit, settled_usage())]
        )

        report, _usage = run_engine(new_store(), transport)

        self.assertEqual(report["status"], "needs_review")
        self.assertLess(
            report["citation_verification"]["relevance_verified"],
            report["citation_verification"]["total"],
        )
        self.assertEqual(
            report["citation_verification"]["relevance_status"],
            "contradicted",
        )
        self.assertEqual(
            cv.trust_labels(report)["citations"],
            "PARTIALLY_VERIFIED_QUOTES",
        )
        self.assertEqual(
            cv.trust_labels(report)["story_spine"], "FACT_AUDITED"
        )

    def test_not_applicable_lens_grade_seals_without_verdict_penalty(self):
        # Calibration rule 8 (Matadero brief): a lens that does not apply
        # grades "not_applicable" and never counts against the script.
        coverage = valid_coverage()
        coverage["lens_notes"][0]["grade"] = "not_applicable"
        coverage["genre_contract"]["met"] = True
        coverage["verdict"] = "RECOMMEND"
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (supported_audit(coverage), settled_usage()),
            ]
        )
        report, _usage = run_engine(new_store(), transport)
        self.assertEqual(report["status"], "sealed")
        self.assertEqual(report["verdict"], "RECOMMEND")
        self.assertEqual(report["cost"]["repair_calls_used"], 0)
        self.assertEqual(
            report["coverage"]["lens_notes"][0]["grade"], "not_applicable"
        )

    def test_calibration_rules_reach_the_prompts(self):
        # The Matadero calibration brief's distilled rules must actually be
        # in the text the model sees, and the report must state its page
        # convention (rule 9).
        system_text = cv.build_coverage_system_blocks("LENSES")[0]["text"]
        for sentinel in (
            "not_applicable",
            "NOT LOCATED:",
            "ledger",
            "dialogue",
            "reversal in the middle",
            "sharpen the existing setup",
            "[PAGE N]",
            # Hermanos brief #2 rules:
            "deus ex machina",
            "continuity_flags",
            "one page past",
            "no turn",
            # Slasher brief #3 rules:
            "HIGH-RISK ASSERTIONS",
            "relationship graph",
            "behavior ledger",
            "function-free",
        ):
            self.assertIn(sentinel, system_text, sentinel)
        self.assertIn("staging", cv.AUDIT_CHARTER)
        self.assertIn("ABSENCE", cv.AUDIT_CHARTER)
        coverage = valid_coverage()
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (supported_audit(coverage), settled_usage()),
            ]
        )
        report, _usage = run_engine(new_store(), transport)
        self.assertIn("[PAGE N]", report["page_convention"])

    def test_unverified_citation_forces_human_review(self):
        # Hermanos brief, recurring 3: a report carrying broken citations
        # can no longer seal as fully trusted with no review flag.
        coverage = valid_coverage()
        coverage["strengths"][0]["excerpt"] = (
            "esta cita no existe en ninguna página"
        )
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (coverage, settled_usage()),
                (supported_audit(coverage), settled_usage()),
            ]
        )
        report, _usage = run_engine(new_store(), transport)
        self.assertEqual(report["status"], "needs_review")
        self.assertTrue(report["human_review_recommended"])
        self.assertTrue(
            any("verified verbatim" in r for r in report["review_reasons"])
        )

    def test_contradicted_concern_blocks_seal_for_review(self):
        # Hermanos brief, defect 1: concerns and the pass case are audited;
        # a contradicted one (e.g. a false "unseeded" claim) flags review.
        coverage = valid_coverage()
        audit = supported_audit(coverage)
        for verdict_row in audit["verdicts"]:
            if verdict_row["claim_id"] == "concerns.point_0":
                verdict_row["classification"] = "contradicted"
                verdict_row["note"] = "La preparación existe en la página 3."
        transport = FakeTransport(
            [(coverage, settled_usage()), (audit, settled_usage())]
        )
        report, _usage = run_engine(new_store(), transport)
        self.assertEqual(report["status"], "needs_review")
        self.assertTrue(report["human_review_recommended"])
        self.assertTrue(
            any(
                "contradicted" in r and "concerns.point_0" in r
                for r in report["review_reasons"]
            )
        )

    def test_character_page_index_is_authoritative_and_in_both_prompts(self):
        # Brief #3, part one: absence claims failed three scripts in a row —
        # both models now receive a code-generated character page index.
        index = cv.build_character_page_index(SCREENPLAY_TEXT)
        self.assertIn("DIEGO", index)
        self.assertNotIn("INT", index.split(":")[0])
        coverage_blocks = cv.build_coverage_user_blocks(
            SCREENPLAY_TEXT, "El Último Portero", 6, "feature", FEATURE_STACK
        )
        audit_blocks = cv.build_audit_user_blocks(
            SCREENPLAY_TEXT,
            "El Último Portero",
            cv.build_audit_claims(valid_coverage()),
        )
        for blocks in (coverage_blocks, audit_blocks):
            joined = "\n".join(str(b.get("text", "")) for b in blocks)
            self.assertIn("CHARACTER PAGE INDEX", joined)
            self.assertIn("AUTHORITATIVE", joined)

    def test_audit_instruction_states_exact_claim_count(self):
        # Haiku drops the last claim on long lists (Hermanos and Slasher
        # runs both lost 'pass_reason', spending the repair slot on a
        # Sonnet retry) — the instruction now pins the exact count.
        claims = cv.build_audit_claims(valid_coverage())
        blocks = cv.build_audit_user_blocks("texto", "Título", claims)
        instruction = blocks[-1]["text"]
        self.assertIn(f"exactly {len(claims)} claims", instruction)
        self.assertIn("the last one included", instruction)

    def test_audit_claims_cover_concerns_and_pass_reason(self):
        claims = cv.build_audit_claims(valid_coverage())
        ids = {claim["claim_id"] for claim in claims}
        self.assertIn("concerns.point_0", ids)
        self.assertIn("concerns.point_2", ids)
        self.assertIn("pass_reason", ids)
        self.assertLessEqual(len(claims), cv.MAX_AUDIT_CLAIMS)

    def test_v12_guard_claims_cover_all_p0_reliability_gates(self):
        claims = cv.build_audit_claims(valid_coverage())
        ids = {claim["claim_id"] for claim in claims}
        expected = {
            "guard.page_reference_integrity",
            "guard.existing_evidence",
            "guard.cross_field_consistency",
            "guard.sequence_integrity",
            "guard.citation_relevance",
        }
        self.assertTrue(expected.issubset(ids))
        self.assertTrue(all(cv.is_central_claim(claim_id) for claim_id in expected))
        self.assertLessEqual(len(claims), cv.MAX_AUDIT_CLAIMS)

    def test_la_ciguena_and_sola_existing_evidence_reaches_audit(self):
        coverage = valid_coverage()
        coverage["concerns"][0]["point"] = (
            "La cigüeña nunca tiene contacto sustantivo antes del midpoint"
        )
        coverage["development_priorities"][0] = {
            "priority": "Agregar una primera preparación del campamento",
            "why": "La logística del campamento no existe antes de la trampa",
            "how": "Plantar una escena nueva donde preparan el campamento",
        }
        screenplay = """\
[PAGE 1]
La pesadilla muestra una CIGÜEÑA que toca la ventana.
[PAGE 2]
Los asesinos preparan el campamento y luego mueven el cuerpo.
"""

        checks = cv.build_existing_evidence_checks(coverage, screenplay)
        by_path = {check["field_path"]: check for check in checks}

        self.assertIn("concerns[0].point", by_path)
        self.assertIn("development_priorities[0]", by_path)
        self.assertEqual(by_path["concerns[0].point"]["matched_pages"], [1])
        self.assertIn(2, by_path["development_priorities[0]"]["matched_pages"])
        self.assertTrue(
            all(check["full_screenplay_searched"] for check in checks)
        )

    def test_cosquillitas_reveal_terms_survive_long_priority_text(self):
        coverage = valid_coverage()
        coverage["development_priorities"][0] = {
            "priority": (
                "Give Richie or another character an active role in planting or "
                "activating the hidden camera that exposes Tony, so the climactic "
                "reversal is something the protagonists caused rather than "
                "something that happened to them"
            ),
            "why": (
                "The current ending is structurally convenient because the video "
                "plays from an unattributed source at the perfect moment"
            ),
            "how": "Aclarar la activación sin agregar un dispositivo nuevo",
        }
        screenplay = "[PAGE 98]\nRICHIE muestra el video privado.\n"

        checks = cv.build_existing_evidence_checks(coverage, screenplay)
        priority = next(
            check for check in checks
            if check["field_path"] == "development_priorities[0]"
        )

        self.assertIn("video", priority["search_terms"])
        self.assertEqual(priority["exact_term_hits"]["video"], [98])
        self.assertLessEqual(len(priority["search_terms"]), 24)

    def test_cosquillitas_reveal_check_surfaces_source_motive_and_aftermath(self):
        coverage = valid_coverage()
        coverage["concerns"][0]["point"] = (
            "The exposé video has no planted camera, source, or character "
            "motive anywhere before it appears on p.97."
        )
        screenplay = """\
[PAGE 73]
{padding} Entre los coralitos de la foto vemos una pequeña cámara oculta.
[PAGE 80]
El concursante rompe el récord del programa.
[PAGE 87]
Tony entrega un reloj y un portafolio lleno de billetes. Richie escucha todo.
[PAGE 97]
Aparece un video en la gran pantalla y seguridad cierra las puertas.
[PAGE 98]
Siguen videos de Richie bailando y videos donde espía a Lucesita.
""".format(padding="relleno " * 120)

        check = next(
            row for row in cv.build_existing_evidence_checks(
                coverage, screenplay
            )
            if row["field_path"] == "concerns[0].point"
        )

        leads = {row["page"]: row for row in check["focused_evidence"]}
        self.assertTrue({73, 87, 97, 98}.issubset(leads))
        self.assertIn("cámara", leads[73]["excerpt"])
        self.assertIn("portafolio lleno de billetes", leads[87]["excerpt"])
        self.assertIn("videos donde espía", leads[98]["excerpt"])
        self.assertEqual(leads[73]["role"], "source_device")
        self.assertEqual(leads[87]["role"], "motive_access")
        self.assertEqual(leads[97]["role"], "reveal")
        self.assertEqual(leads[98]["role"], "provenance_aftermath")
        self.assertNotIn(80, leads)

        coverage["pass_reason"] = (
            "The final video reveal has no established source or activation."
        )
        pass_check = next(
            row for row in cv.build_existing_evidence_checks(
                coverage, screenplay
            )
            if row["field_path"] == "pass_reason"
        )
        self.assertEqual(
            [row["page"] for row in pass_check["focused_evidence"]],
            [73, 87, 97, 98],
        )

    def test_reveal_focus_ignores_ordinary_media_language(self):
        unrelated = (
            "Someone pulls the playback cables, exposing the singers.",
            "The video fallout creates seven pages with no attempted laugh.",
            "The active B Story precedes a video exposure beat.",
            "Tony fabricates a video and possesses public goodwill.",
            "Protect the hero choice after the video; Juanito is the hero "
            "who actively risks his reputation.",
            "The video plays while Juanito, who activates the crowd, sings.",
            "The final video works because Juanito, who activates the crowd "
            "through song, earns the victory.",
            "The final video works because Juanito, who records the highest "
            "score, wins the contest.",
            "The final video works because Juanito captures the crowd.",
            "The final video works because Juanito transmits emotion.",
            "The conversation has no emotional setup.",
            "The confession scene has no dramatic setup.",
            "The audio scene has no comic setup.",
            "Protect Juanito, who captures the crowd during the audio "
            "performance, as the active hero.",
            "Protect Juanito, who records the highest score during a "
            "conversation, as the active hero.",
            "The final video works because Juanito, who records the highest "
            "score during a conversation, wins.",
            "The final video works because Juanito, who captures the crowd "
            "beside the camera, wins.",
            "The screen gag works because Juanito, who transmits emotion "
            "through the audio performance, earns applause.",
        )
        for claim in unrelated:
            with self.subTest(claim=claim):
                self.assertFalse(cv._is_reveal_provenance_claim(claim))

        for claim in (
            "No scene establishes who recorded or uploaded the video.",
            "No scene establishes who captured the confession.",
            "Clarify who activates the existing camera footage.",
            "The footage source remains unconfirmed.",
        ):
            with self.subTest(claim=claim):
                self.assertTrue(cv._is_reveal_provenance_claim(claim))

    def test_uncited_reveal_prefers_evidence_cluster_over_later_screen(self):
        coverage = valid_coverage()
        coverage["pass_reason"] = (
            "No scene establishes who recorded or uploaded the final exposé "
            "video on p.5."
        )
        screenplay = """\
[PAGE 3]
A hidden camera records the room.
[PAGE 4]
A teammate learns the bribe and retains access.
[PAGE 5]
The exposé video appears on the auditorium screen.
[PAGE 6]
The private footage continues and reveals the archive.
[PAGE 10]
A vacation gift video plays on a screen.
[PAGE 11]
Someone uploads and broadcasts another vacation video.
"""

        check = next(
            row for row in cv.build_existing_evidence_checks(
                coverage, screenplay
            )
            if row["field_path"] == "pass_reason"
        )

        self.assertEqual(
            [row["page"] for row in check["focused_evidence"]],
            [3, 4, 5, 6],
        )

    def test_ambiguous_reveal_clusters_fail_closed(self):
        coverage = valid_coverage()
        coverage["pass_reason"] = (
            "No scene establishes who recorded or uploaded the video."
        )
        source = """\
[PAGE 2]
A video plays on the screen.
[PAGE 10]
Another video plays on another screen.
"""
        check = next(
            row for row in cv.build_existing_evidence_checks(coverage, source)
            if row["field_path"] == "pass_reason"
        )
        self.assertEqual(check["focused_evidence"], [])
        self.assertTrue(check["focused_evidence_ambiguous"])
        detail_row = next(
            row for row in cv.build_detail_audit_rows(coverage, [check])
            if row["identifier"] == "pass_reason"
        )
        payload = {"results": {
            detail_row["slot"]: "supported: The claim appears accurate."
        }}

        evidence, _ = cv.decode_detail_audit_payload(
            payload, [detail_row], source
        )

        self.assertEqual(evidence[0]["classification"], "unsupported")
        self.assertIn("FOCUSED_EVIDENCE_AMBIGUOUS", evidence[0]["note"])

    def test_cosquillitas_material_counts_receive_a_detailed_check(self):
        claims = (
            "Tony bribes three of four contest judges",
            "Tony bribes three of the four contest judges",
            "Tony bribes three out of four contest judges",
            "Tony soborna a tres de los cuatro jueces",
            "Tony bribes 3/4 judges",
            "Tony bribes three corrupt contest judges",
            "Tony bribes three of a four-judge panel",
            "On p.87, Tony bribes three judges",
            "Tony bribes a trio of judges",
            "Tony soborna a un trío de jueces",
            "Tony bribes three contestants",
        )
        for claim in claims:
            with self.subTest(claim=claim):
                coverage = valid_coverage()
                coverage["story_spine"]["opposition"] = claim

                checks = cv.build_existing_evidence_checks(
                    coverage, SCREENPLAY_TEXT
                )
                count_check = next(
                    check for check in checks
                    if check["field_path"] == "story_spine.opposition"
                )

                self.assertEqual(count_check["trigger"], "counting_claim")
                self.assertEqual(cv._material_count_claimed_total(claim), 3)
                self.assertEqual(count_check["claimed_total"], 3)
                if claim in claims[:5] or "four-judge" in claim:
                    self.assertEqual(count_check["claimed_universe_total"], 4)
                else:
                    self.assertIsNone(count_check["claimed_universe_total"])

    def test_cosquillitas_methodology_ratio_is_not_a_story_fact_count(self):
        coverage = valid_coverage()
        analysis = (
            "The playback scene clears four of five viral checklist items, "
            "and the comedy lens remains a professional judgment."
        )
        coverage["lens_notes"][0]["analysis"] = analysis

        checks = cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT)

        self.assertIsNone(cv._material_count_claimed_total(analysis))
        self.assertNotIn(
            "lens_notes[0].analysis",
            {check["field_path"] for check in checks},
        )
        self.assertIsNone(cv._material_count_claim_details(
            "Of the five viral checklist items, four pass."
        ))

    def test_cosquillitas_methodology_ratio_cannot_cross_into_next_sentence(self):
        claim = (
            "The set piece clears four of the five viral-checklist boxes. "
            "Runner architecture is strong."
        )

        self.assertEqual(cv._material_count_claims_details(claim), [])
        self.assertEqual(
            [
                row["claimed_total"]
                for row in cv._material_count_claims_details(
                    "It clears four of five boxes. Two judges are bribed."
                )
            ],
            [2],
        )
        for story_fact in (
            "Four of five viral contestants are eliminated.",
            "Four of five methodology judges are bribed.",
        ):
            with self.subTest(story_fact=story_fact):
                details = cv._material_count_claims_details(story_fact)
                self.assertEqual(details[0]["claimed_total"], 4)
                self.assertEqual(details[0]["claimed_universe_total"], 5)

    def test_ratio_suppression_is_local_to_the_selected_fact(self):
        claims = (
            "This lens is useful. Tony bribes three of four judges.",
            "The methodology notes that Tony bribes three of four judges.",
            "The rubric reveals that three of four judges are bribed.",
            "Three of four contestants go viral after the performance.",
        )

        for claim in claims:
            with self.subTest(claim=claim):
                details = cv._material_count_claim_details(claim)
                self.assertEqual(details["claimed_total"], 3)
                self.assertEqual(details["claimed_universe_total"], 4)

    def test_ratio_quantifier_belongs_to_the_selected_count(self):
        details = cv._material_count_claim_details(
            "At least one beat works, but Tony bribes exactly three of four "
            "judges."
        )

        self.assertEqual(details["claimed_total"], 3)
        self.assertEqual(details["claimed_universe_total"], 4)
        self.assertEqual(details["count_quantifier"], "exact")

    def test_daddy_issues_napkin_item_counts_remain_auditable(self):
        exact = cv._material_count_claim_details(
            "The napkin contains ten items."
        )
        ratio = cv._material_count_claim_details(
            "The montage covers nine of the ten items on the napkin list."
        )

        self.assertEqual(exact["claimed_total"], 10)
        self.assertIsNone(exact["claimed_universe_total"])
        self.assertEqual(ratio["claimed_total"], 9)
        self.assertEqual(ratio["claimed_universe_total"], 10)

    def test_cosquillitas_human_audit_count_categories_are_auditable(self):
        claims = (
            ("His ritual is cut off by the curtain three times.", 3),
            (
                "The ending contains five resolutions, including world peace "
                "and a pregnancy.",
                5,
            ),
            ("That is eleven distinct page laughs.", 11),
            ("All three runners receive payoffs.", 3),
        )

        for claim, expected in claims:
            with self.subTest(claim=claim):
                self.assertEqual(
                    cv._material_count_claimed_total(claim), expected
                )

    def test_correlative_both_is_not_a_count(self):
        claim = (
            "It serves both as a recurring laugh and as a structural metaphor."
        )

        self.assertEqual(cv._material_count_claims_details(claim), [])
        self.assertEqual(
            cv._material_count_claimed_total("Both judges are bribed."), 2
        )

    def test_every_material_count_in_one_field_gets_its_own_guard(self):
        coverage = valid_coverage()
        coverage["story_spine"]["opposition"] = (
            "Two of four judges are bribed, and five contestants perform."
        )

        checks = [
            row for row in cv.build_existing_evidence_checks(
                coverage, SCREENPLAY_TEXT
            )
            if row["source_field_path"] == "story_spine.opposition"
            and row["trigger"] == "counting_claim"
        ]

        self.assertEqual(
            [row["field_path"] for row in checks],
            [
                "story_spine.opposition#count_1",
                "story_spine.opposition#count_2",
            ],
        )
        self.assertEqual(
            [
                (row["claimed_total"], row["claimed_universe_total"])
                for row in checks
            ],
            [(2, 4), (5, None)],
        )

    def test_sibling_counts_keep_distinct_entities_and_anchors(self):
        coverage = valid_coverage()
        coverage["story_spine"]["opposition"] = (
            "Two judges are bribed and two contestants perform."
        )

        checks = [
            row for row in cv.build_existing_evidence_checks(
                coverage, SCREENPLAY_TEXT
            )
            if row["source_field_path"] == "story_spine.opposition"
            and row["trigger"] == "counting_claim"
        ]

        self.assertEqual(
            [(row["count_entity"], row["count_anchor"]) for row in checks],
            [("judges", "Two judges"), ("contestants", "two contestants")],
        )

    def test_anaphoric_sibling_count_inherits_the_material_entity(self):
        details = cv._material_count_claims_details(
            "Four judges appear; two are bribed."
        )

        self.assertEqual(
            [
                (
                    row["claimed_total"],
                    row["claimed_universe_total"],
                    row["count_entity"],
                    row["count_anchor"],
                )
                for row in details
            ],
            [
                (4, None, "judges", "Four judges"),
                (2, 4, "judges", "two are bribed"),
            ],
        )

    def test_same_entity_sibling_counts_share_universe_with_own_predicates(self):
        source = (
            "[PAGE 7]\n"
            "First judge appears and accepts Tony's bribe. "
            "Second judge appears and accepts Tony's bribe. "
            "Third judge appears and refuses Tony's bribe. "
            "Fourth judge appears and refuses Tony's bribe.\n"
        )
        claim = "Four judges appear; two are bribed."
        coverage = valid_coverage()
        coverage["story_spine"]["opposition"] = claim
        rows = [
            row for row in cv.build_detail_audit_rows(
                coverage,
                cv.build_existing_evidence_checks(coverage, source),
            )
            if row["subject"].get("trigger") == "counting_claim"
        ]
        excerpts = (
            "First judge appears and accepts Tony's bribe",
            "Second judge appears and accepts Tony's bribe",
            "Third judge appears and refuses Tony's bribe",
            "Fourth judge appears and refuses Tony's bribe",
        )
        payload = {"results": {
            row["slot"]: {
                "classification": "supported",
                "observed_total": 4 if index == 0 else 2,
                "observed_universe_total": 4,
                "instances": [
                    {
                        "label": f"judge {instance_index}",
                        "page": 7,
                        "excerpt": excerpt,
                        "matches_claim": index == 0 or instance_index <= 2,
                    }
                    for instance_index, excerpt in enumerate(excerpts, 1)
                ],
                "note": "Each row tests its own predicate over four judges.",
            }
            for index, row in enumerate(rows)
        }}

        evidence, _citations = cv.decode_detail_audit_payload(
            payload, rows, source
        )

        self.assertEqual(len(rows), 2)
        self.assertTrue(all(row["count_ledger"]["valid"] for row in evidence))
        self.assertEqual(
            [row["count_ledger"]["observed_total"] for row in evidence],
            [4, 2],
        )

    def test_sibling_counts_cannot_reuse_the_same_screenplay_evidence(self):
        source = (
            "[PAGE 7]\nFirst judge takes the stage. "
            "Second judge takes the stage.\n"
        )
        claim = "Two judges are bribed and two contestants perform."
        coverage = valid_coverage()
        coverage["story_spine"]["opposition"] = claim
        rows = [
            row for row in cv.build_detail_audit_rows(
                coverage,
                cv.build_existing_evidence_checks(coverage, source),
            )
            if row["subject"].get("trigger") == "counting_claim"
        ]
        payload = {"results": {
            row["slot"]: {
                "classification": "supported",
                "observed_total": 2,
                "observed_universe_total": 2,
                "instances": [
                    {
                        "label": f"instance {index}",
                        "page": 7,
                        "excerpt": excerpt,
                        "matches_claim": True,
                    }
                    for index, excerpt in (
                        (1, "First judge takes the stage"),
                        (2, "Second judge takes the stage"),
                    )
                ],
                "note": "Two matching instances are claimed.",
            }
            for row in rows
        }}

        evidence, _citations = cv.decode_detail_audit_payload(
            payload, rows, source
        )

        self.assertTrue(evidence[0]["count_ledger"]["valid"])
        self.assertFalse(evidence[1]["count_ledger"]["valid"])
        self.assertIn("already used by count row", evidence[1]["note"])

    def test_priority_edit_targets_are_not_current_screenplay_counts(self):
        coverage = valid_coverage()
        coverage["development_priorities"][0] = {
            "priority": "Cut the section from ten pages to five",
            "why": "The current sequence repeats",
            "how": "Select three list items and use two rapid cross-cuts",
        }

        rows = [
            row for row in cv.build_existing_evidence_checks(
                coverage, SCREENPLAY_TEXT
            )
            if row["source_field_path"] == "development_priorities[0]"
        ]

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["trigger"], "recommendation")

    def test_count_and_independent_absence_claim_get_separate_guards(self):
        coverage = valid_coverage()
        coverage["story_spine"]["opposition"] = (
            "Two of four judges are bribed, but the exposé video has no setup "
            "anywhere."
        )

        checks = [
            row for row in cv.build_existing_evidence_checks(
                coverage, "[PAGE 3]\nRichie plants the exposé camera.\n"
            )
            if row["source_field_path"] == "story_spine.opposition"
        ]

        self.assertEqual(
            [(row["field_path"], row["trigger"]) for row in checks],
            [
                ("story_spine.opposition#count_1", "counting_claim"),
                ("story_spine.opposition#absolute", "absolute_negative"),
            ],
        )
        self.assertIn(3, checks[1]["matched_pages"])

    def test_cosquillitas_currency_stakes_are_not_a_counting_claim(self):
        coverage = valid_coverage()
        coverage["story_spine"]["stakes"] = (
            "The five-million-peso prize that would end Juanito's poverty."
        )
        coverage["story_spine"]["major_turns"][-1]["turn"] = (
            "Two bribed judges score him 5 and 2 before the result is voided."
        )

        checks = cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT)
        by_path = {check["field_path"]: check for check in checks}

        self.assertNotIn("story_spine.stakes", by_path)
        self.assertEqual(
            by_path["story_spine.major_turns[2].turn"]["claimed_total"], 2
        )

    def test_count_parser_handles_entity_before_and_inside_ratios(self):
        claims = (
            "Judges: two of four are bribed.",
            "Of the four judges, two are bribed.",
            "Jueces: dos de cuatro están sobornados.",
            "De los cuatro jueces, dos están sobornados.",
        )

        for claim in claims:
            with self.subTest(claim=claim):
                details = cv._material_count_claim_details(claim)
                self.assertEqual(details["claimed_total"], 2)
                self.assertEqual(details["claimed_universe_total"], 4)

    def test_direct_ratio_keeps_its_own_numerator(self):
        claims = (
            ("One of the four judges gave two points.", 1, 4),
            ("Two of the four judges score 10.", 2, 4),
            ("Three of five contestants perform two songs.", 3, 5),
        )

        for claim, numerator, denominator in claims:
            with self.subTest(claim=claim):
                details = cv._material_count_claim_details(claim)
                self.assertEqual(details["claimed_total"], numerator)
                self.assertEqual(
                    details["claimed_universe_total"], denominator
                )

    def test_english_once_is_not_spanish_eleven(self):
        occurrence_claims = (
            ("Richie reveals the source once.", 1),
            ("The ritual happens once.", 1),
            ("The ritual is interrupted twice.", 2),
        )
        for claim, total in occurrence_claims:
            with self.subTest(claim=claim):
                self.assertEqual(
                    cv._material_count_claimed_total(claim), total
                )

        conjunction_claims = (
            "Once judges arrive, Tony bribes them.",
            "Once members gather, the ritual begins.",
            "Once contestants perform, the panel votes.",
        )

        for claim in conjunction_claims:
            with self.subTest(claim=claim):
                self.assertIsNone(cv._material_count_claim_details(claim))
        details = cv._material_count_claims_details(
            "Once the four judges arrive, Tony acts."
        )
        self.assertEqual(
            [row["claimed_total"] for row in details], [4]
        )

        coverage = valid_coverage()
        coverage["strengths"][0]["point"] = (
            "His pre-show ritual is cut off once by the curtain."
        )
        check = next(
            row for row in cv.build_existing_evidence_checks(
                coverage, SCREENPLAY_TEXT
            )
            if row["source_field_path"] == "strengths[0].point"
        )
        self.assertEqual(check["trigger"], "counting_claim")
        self.assertEqual(check["claimed_total"], 1)

    def test_entity_before_count_syntax_remains_auditable(self):
        claims = (
            ("Judges bribed: two.", 2, "judges"),
            ("The number of bribed judges is two.", 2, "judges"),
            ("Jueces sobornados: dos.", 2, "jueces"),
        )
        for claim, total, entity in claims:
            with self.subTest(claim=claim):
                details = cv._material_count_claim_details(claim)
                self.assertEqual(details["claimed_total"], total)
                self.assertEqual(details["count_entity"], entity)

    def test_spanish_once_is_eleven_in_count_syntax(self):
        exact = cv._material_count_claim_details("Hay once jueces presentes.")
        ratio = cv._material_count_claim_details(
            "Once de doce jueces están presentes."
        )

        self.assertEqual(exact["claimed_total"], 11)
        self.assertEqual(ratio["claimed_total"], 11)
        self.assertEqual(ratio["claimed_universe_total"], 12)

    def test_count_parser_preserves_minimum_quantifier(self):
        details = cv._material_count_claim_details(
            "At least two of the four judges are bribed."
        )

        self.assertEqual(details["claimed_total"], 2)
        self.assertEqual(details["claimed_universe_total"], 4)
        self.assertEqual(details["count_quantifier"], "minimum")

    def test_absolute_wording_cannot_bypass_count_ledgers(self):
        claims = (
            ("Only two judges are bribed.", 2),
            ("Solo dos jueces están sobornados.", 2),
            ("Only three of four judges are bribed.", 3),
            ("Solo tres de cuatro jueces están sobornados.", 3),
        )

        for claim, total in claims:
            with self.subTest(claim=claim):
                coverage = valid_coverage()
                coverage["story_spine"]["opposition"] = claim
                check = next(
                    row for row in cv.build_existing_evidence_checks(
                        coverage, SCREENPLAY_TEXT
                    )
                    if row["field_path"] == "story_spine.opposition"
                )
                self.assertEqual(check["trigger"], "counting_claim")
                self.assertEqual(check["claimed_total"], total)

    def test_judge_scores_are_not_mistaken_for_a_judge_count(self):
        self.assertIsNone(
            cv._material_count_claimed_total("The judges score him 5 and 2.")
        )
        self.assertIsNone(
            cv._material_count_claimed_total(
                "Los jueces califican la canción con 5 y 2."
            )
        )
        examples = (
            ("A score of 10 comes from two judges.", [2]),
            ("The scores are 10, 10, 5, and 2 from four judges.", [4]),
            ("Las calificaciones 5 y 2 vienen de dos jueces.", [2]),
        )
        for claim, expected in examples:
            with self.subTest(claim=claim):
                self.assertEqual(
                    [
                        row["claimed_total"]
                        for row in cv._material_count_claims_details(claim)
                    ],
                    expected,
                )

    def test_reaudit_reuses_only_unchanged_valid_count_subjects(self):
        coverage = valid_coverage()
        coverage["story_spine"]["opposition"] = "Two judges oppose Diego."
        checks = cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT)
        prior_audit = supported_audit(coverage)
        prior_result = next(
            row for row in prior_audit["existing_evidence_verdicts"]
            if row["field_path"] == "story_spine.opposition"
        )
        prior_result["count_ledger"] = {"valid": True}

        current_rows = cv.build_detail_audit_rows(coverage, checks)
        seeded, _citations, pending = cv._reusable_detail_seed(
            coverage, checks, prior_audit, current_rows
        )
        self.assertTrue(any(
            row["field_path"] == "story_spine.opposition" for row in seeded
        ))
        self.assertFalse(any(
            row["identifier"] == "story_spine.opposition" for row in pending
        ))

        changed = copy.deepcopy(coverage)
        changed["story_spine"]["opposition"] = "Three judges oppose Diego."
        changed_rows = cv.build_detail_audit_rows(
            changed,
            cv.build_existing_evidence_checks(changed, SCREENPLAY_TEXT),
        )
        _seeded, _citations, changed_pending = cv._reusable_detail_seed(
            coverage, checks, prior_audit, changed_rows
        )
        self.assertTrue(any(
            row["identifier"] == "story_spine.opposition"
            for row in changed_pending
        ))

    def test_count_parser_ignores_measurements_and_rubric_numbers(self):
        examples = (
            ("That is seven distinct laugh moments across 89 pages.", [7]),
            ("The montage covers nine list items in three pages.", [9]),
            ("(5) Resolution closes the Story Grid analysis.", []),
            ("A three-page escalating sequence ends in a physical reveal.", []),
            ("Resolution: The six-month jump settles the ending.", []),
            ("Act 3 contains the payoff.", []),
            ("A ten-page laugh-free stretch follows.", []),
            ("Seven consecutive laugh-free pages precede the climax.", []),
            ("Siete paginas consecutivas sin risas preceden el climax.", []),
            ("Seven judges fill three pages.", [7]),
            ("The pig costume and the two-coffees ritual are callbacks.", []),
            ("He scores 10. The third judge gives a five.", []),
            ("Both simultaneously. Diego kills the attacker.", []),
            ("One scream. Comic runners return later.", []),
            ("The ending offers two or three resolutions.", [2]),
            ("El final ofrece dos o tres resoluciones.", [2]),
        )
        for claim, expected in examples:
            with self.subTest(claim=claim):
                self.assertEqual(
                    [
                        row["claimed_total"]
                        for row in cv._material_count_claims_details(claim)
                    ],
                    expected,
                )
        ranged = cv._material_count_claim_details(
            "Tony bribes two or three judges."
        )
        self.assertEqual(ranged["count_quantifier"], "range")
        self.assertEqual(ranged["claimed_total"], 2)
        self.assertEqual(ranged["claimed_max_total"], 3)
        self.assertEqual(
            cv._material_count_claimed_total("The ritual repeats two times."),
            2,
        )

    def test_count_evidence_is_trimmed_and_uniquely_relocated(self):
        source = (
            "[PAGE 94]\n"
            "The first judge accepts Tony's expensive watch and the suitcase "
            "full of cash before smiling at him.\n"
            "[PAGE 95]\n"
            "The second judge accepts Tony's gift.\n"
        )
        subject = {
            "field_path": "synopsis#count_1",
            "source_field_path": "synopsis",
            "trigger": "counting_claim",
            "claim": "Tony bribes two judges.",
            "claimed_total": 2,
            "claimed_universe_total": None,
            "count_quantifier": "exact",
            "count_entity": "judges",
            "count_anchor": "two judges",
        }
        rows = [{
            "kind": "existing_evidence",
            "identifier": "synopsis#count_1",
            "subject": subject,
            "slot": "row_001",
        }]
        payload = {"results": {"row_001": {
            "classification": "supported",
            "observed_total": 2,
            "observed_universe_total": 2,
            "instances": [
                {
                    "label": "first bribed judge",
                    "page": 95,
                    "excerpt": (
                        "The first judge accepts Tony's expensive watch and "
                        "the suitcase full of cash before smiling at him"
                    ),
                    "matches_claim": True,
                    "multiplicity": 1,
                },
                {
                    "label": "second bribed judge",
                    "page": 95,
                    "excerpt": "The second judge accepts Tony's gift",
                    "matches_claim": True,
                    "multiplicity": 1,
                },
            ],
            "note": "Two judges accept Tony's gifts.",
        }}}

        evidence, _citations = cv.decode_detail_audit_payload(
            payload, rows, source
        )

        ledger = evidence[0]["count_ledger"]
        self.assertTrue(ledger["valid"])
        first = ledger["instances"][0]
        self.assertEqual(first["page"], 94)
        self.assertEqual(first["page_normalized_from"], 95)
        self.assertEqual(len(first["excerpt"].split()), 12)
        self.assertIn("excerpt_normalized_from", first)

    def test_unstated_count_universe_is_not_compared_as_zero(self):
        source = (
            "[PAGE 97]\nFirst judge is bribed. Second judge is bribed. "
            "Third judge refuses. Fourth judge refuses.\n"
        )
        claim = "Two judges are bribed."
        rows = [{
            "slot": "row_001",
            "kind": "existing_evidence",
            "identifier": "synopsis#count_1",
            "subject": {
                "field_path": "synopsis#count_1",
                "source_field_path": "synopsis",
                "trigger": "counting_claim",
                "claim": claim,
                **cv._material_count_claim_details(claim),
            },
        }]
        payload = {"results": {"row_001": {
            "classification": "supported",
            "observed_total": 2,
            "observed_universe_total": 4,
            "instances": [
                {
                    "label": label,
                    "page": 97,
                    "excerpt": excerpt,
                    "matches_claim": index < 2,
                    "multiplicity": 1,
                }
                for index, (label, excerpt) in enumerate((
                    ("first judge", "First judge is bribed"),
                    ("second judge", "Second judge is bribed"),
                    ("third judge", "Third judge refuses"),
                    ("fourth judge", "Fourth judge refuses"),
                ))
            ],
            "note": "Two of four observed judges are bribed.",
        }}}

        evidence, _citations = cv.decode_detail_audit_payload(
            payload, rows, source
        )

        self.assertEqual(evidence[0]["classification"], "supported")
        self.assertTrue(evidence[0]["count_ledger"]["valid"])
        self.assertIsNone(
            evidence[0]["count_ledger"]["claimed_universe_total"]
        )
        self.assertEqual(
            evidence[0]["count_ledger"]["observed_universe_total"], 4
        )

    def test_count_ledger_rejects_non_string_prose_in_both_encodings(self):
        source = "[PAGE 1]\nFirst judge accepts the bribe.\n"
        subject = {
            "field_path": "synopsis#count_1",
            "source_field_path": "synopsis",
            "trigger": "counting_claim",
            "claim": "One judge accepts the bribe.",
            "claimed_total": 1,
            "claimed_universe_total": None,
            "count_quantifier": "exact",
            "count_entity": "judge",
            "count_anchor": "One judge",
        }
        valid = {
            "classification": "supported",
            "observed_total": 1,
            "observed_universe_total": 1,
            "instances": [{
                "label": "first judge",
                "page": 1,
                "excerpt": "First judge accepts the bribe",
                "matches_claim": True,
                "multiplicity": 1,
            }],
            "note": "One matching judge appears.",
        }
        invalid_values = (False, None, 3, ["text"], {"text": "value"})

        for encoding in ("object", "json_string"):
            for field in ("note", "label", "excerpt"):
                for invalid_value in invalid_values:
                    with self.subTest(
                        encoding=encoding,
                        field=field,
                        invalid_value=invalid_value,
                    ):
                        candidate = copy.deepcopy(valid)
                        if field == "note":
                            candidate[field] = invalid_value
                        else:
                            candidate["instances"][0][field] = invalid_value
                        value = (
                            json.dumps(candidate)
                            if encoding == "json_string"
                            else candidate
                        )

                        result = cv._decode_count_audit_result(
                            value, subject, source
                        )

                        self.assertFalse(result["count_ledger"]["valid"])

    def test_spanish_article_after_entity_is_not_a_count(self):
        self.assertEqual(
            cv._material_count_claims_details(
                "la invisibilización de las víctimas, o como una deficiencia"
            ),
            [],
        )
        details = cv._material_count_claim_details("Hay una víctima visible.")
        self.assertEqual(details["claimed_total"], 1)
        self.assertEqual(details["count_entity"], "víctima")

    def test_comparative_count_bounds_are_integer_safe(self):
        examples = (
            ("More than two of four judges are bribed.", 3, "minimum"),
            ("Más de dos de cuatro jueces están sobornados.", 3, "minimum"),
            ("Fewer than three of four judges are bribed.", 2, "maximum"),
            ("Menos de tres de cuatro jueces están sobornados.", 2, "maximum"),
            ("No fewer than two judges are bribed.", 2, "minimum"),
            ("No more than two judges are bribed.", 2, "maximum"),
        )
        for claim, total, quantifier in examples:
            with self.subTest(claim=claim):
                details = cv._material_count_claim_details(claim)
                self.assertEqual(details["claimed_total"], total)
                self.assertEqual(details["count_quantifier"], quantifier)

        coverage = valid_coverage()
        coverage["story_spine"]["opposition"] = (
            "No fewer than two judges are bribed."
        )
        rows = [
            row for row in cv.build_existing_evidence_checks(
                coverage, SCREENPLAY_TEXT
            )
            if row["source_field_path"] == "story_spine.opposition"
        ]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["trigger"], "counting_claim")

    def test_commercial_judgment_is_not_a_screenplay_evidence_claim(self):
        coverage = valid_coverage()
        coverage["commercial_hypothesis"] = (
            "Popstar: Never Stop Never Stopping is a useful comparison; "
            "complete the positioning work first."
        )

        checks = cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT)

        self.assertNotIn(
            "commercial_hypothesis",
            {check["field_path"] for check in checks},
        )

    def test_cosquillitas_reliability_rules_reach_both_readers(self):
        self.assertIn("leftover writer directives", cv.COVERAGE_CHARTER)
        self.assertIn("reduced comedy density", cv.COVERAGE_CHARTER)
        audit_charter = " ".join(cv.AUDIT_CHARTER.split())
        self.assertIn("enumerate every on-page instance", audit_charter)
        self.assertIn("collapse, coma, and death", audit_charter)
        self.assertIn("reveal provenance", audit_charter)

        detail_text = cv.build_detail_audit_user_blocks(
            SCREENPLAY_TEXT,
            "Cosquillitas",
            valid_coverage(),
            cv.build_page_reference_map(SCREENPLAY_TEXT, 6, None),
            [],
        )[-1]["text"]
        self.assertIn("ENGINE-BOUND SOURCE IDS", "\n".join(
            block["text"] for block in cv.build_detail_audit_user_blocks(
                SCREENPLAY_TEXT,
                "Cosquillitas",
                valid_coverage(),
                cv.build_page_reference_map(SCREENPLAY_TEXT, 6, None),
                [],
            )
        ))
        self.assertIn("Never return a page or quote", detail_text)
        self.assertIn("exactly source_id, matches_claim", detail_text)
        self.assertIn("<slot>:<field>:<source_id>", detail_text)
        self.assertIn(cv.SEQUENCE_SOURCE_NOT_LOCATED, detail_text)
        self.assertIn("partially_supported only for a mix", detail_text)
        self.assertIn("empty instances array is safer", detail_text)
        self.assertIn("reveal provenance", detail_text)
        self.assertIn("capture/source", detail_text)
        self.assertIn("continuity_flags", detail_text)
        self.assertIn(
            "code owns both claimed and observed totals", detail_text.lower()
        )
        self.assertIn("one intentional gag", detail_text)
        self.assertIn("subject.claimed_universe_total", detail_text)
        self.assertIn("story facts repeated inside the commercial", audit_charter)
        consistency_claim = next(
            claim["statement"] for claim in cv.build_audit_claims(valid_coverage())
            if claim["claim_id"] == "guard.cross_field_consistency"
        )
        self.assertIn("logline", consistency_claim)
        self.assertIn("commercial hypothesis", consistency_claim)
        self.assertIn(
            "validated sequence ledger as authoritative",
            cv.FACT_REPAIR_CHARTER,
        )
        self.assertIn("logline, synopsis", cv.FACT_REPAIR_CHARTER)
        self.assertIn("never recommend", cv.FACT_REPAIR_CHARTER)
        self.assertIn("remove that absolute everywhere", cv.FACT_REPAIR_CHARTER)

    def test_cosquillitas_writer_directives_are_deterministically_flagged(self):
        screenplay = SCREENPLAY_TEXT.replace(
            "[PAGE 5]",
            "[PAGE 5]\nJuntar esta parte con la del cementerio.\n",
        ).replace(
            "[PAGE 6]",
            "[PAGE 6]\nMeter amando\nhan escuchado absolutamente TODO.\n",
        )
        coverage = valid_coverage()
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (supported_audit(coverage), settled_usage()),
            ]
        )

        report, _usage = run_engine(
            new_store(), transport, text=screenplay
        )

        self.assertEqual(report["status"], "sealed")
        self.assertEqual(len(report["coverage"]["continuity_flags"]), 1)
        flag = report["coverage"]["continuity_flags"][0]
        self.assertIn("p.5", flag)
        self.assertIn("Juntar esta parte", flag)
        self.assertIn("p.6", flag)
        self.assertIn("Meter amando", flag)
        directive_summary = report["diagnostics"]["writer_directives"]
        self.assertEqual(len(directive_summary["found"]), 2)
        self.assertEqual(len(directive_summary["added"]), 2)
        self.assertEqual(directive_summary["unreported"], [])

    def test_literal_ending_focus_keeps_opening_and_last_scene(self):
        focus = cv.build_sequence_focus(SCREENPLAY_TEXT)
        self.assertEqual(focus["opening_pages"], [1, 2, 3])
        self.assertIn(6, focus["ending_pages"])
        self.assertIn("[PAGE 1]", focus["text"])
        self.assertIn("[PAGE 6]", focus["text"])

    def test_canonical_fact_registry_has_one_climax_and_ending(self):
        registry = cv.build_canonical_fact_registry(valid_coverage())
        self.assertEqual(
            registry["climax"],
            valid_coverage()["story_spine"]["climax"],
        )
        self.assertEqual(
            registry["ending"],
            valid_coverage()["story_spine"]["ending"],
        )
        self.assertEqual(len(registry["major_turns"]), 3)
        self.assertIn("registry_sha256", registry)

    def test_v12_evidence_material_reaches_the_fact_auditor(self):
        coverage = valid_coverage()
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (supported_audit(coverage), settled_usage()),
            ]
        )

        report, _usage = run_engine(new_store(), transport)

        audit_text = "\n".join(
            str(block.get("text", ""))
            for block in transport.calls[1]["user_blocks"]
        )
        for heading in (
            "PAGE REFERENCE MAP",
            "CANONICAL FACT REGISTRY",
            "EXISTING-EVIDENCE CHECKS",
            "CLIMAX AND ENDING FOCUS",
            "COMPLETE COVERAGE REPORT",
        ):
            self.assertIn(heading, audit_text)
        for instruction in (
            "actor",
            "action",
            "character knowledge",
            "final scene",
            "tag",
            "aftermath",
        ):
            self.assertIn(instruction, audit_text)
        self.assertEqual(
            report["citation_verification"]["relevance_status"],
            "supported",
        )
        self.assertEqual(
            report["citation_verification"]["relevance_verified"],
            report["citation_verification"]["total"],
        )
        self.assertEqual(
            {row["phase"] for row in report["fact_audit"]["sequence_ledger"]},
            {"climax", "ending", "final_scene", "tag", "aftermath"},
        )
        self.assertTrue(
            all(
                check["audit_classification"] == "supported"
                for check in report["diagnostics"]["existing_evidence_checks"]
            )
        )

    def test_audit_tool_pins_exact_runtime_ids_and_row_counts(self):
        coverage = valid_coverage()
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (supported_audit(coverage), settled_usage()),
            ]
        )

        run_engine(new_store(), transport)

        schema = transport.calls[1]["tool"]["input_schema"]
        claims = cv.build_audit_claims(coverage)
        evidence = cv.build_existing_evidence_checks(
            coverage, SCREENPLAY_TEXT
        )
        citation_owners = [
            owner for owner, _item in cv._iter_citations(coverage)
        ]
        verdicts = schema["properties"]["verdicts"]

        self.assertEqual(verdicts["minItems"], len(claims))
        self.assertEqual(verdicts["maxItems"], len(claims))
        self.assertEqual(
            verdicts["items"]["properties"]["claim_id"]["enum"],
            [claim["claim_id"] for claim in claims],
        )
        self.assertNotIn("existing_evidence_verdicts", schema["properties"])
        self.assertNotIn("citation_relevance", schema["properties"])
        self.assertEqual(
            set(schema["properties"]["sequence_ledger"]["properties"]),
            {"climax", "ending", "final_scene", "tag", "aftermath"},
        )
        self.assertEqual(
            cv.strict_schema_complexity(schema)["property_count"], 40
        )
        for phase in cv.AUDIT_SEQUENCE_PHASES:
            self.assertNotIn(
                "order",
                schema["properties"]["sequence_ledger"]["properties"][phase][
                    "items"
                ]["properties"],
            )
        self.assertTrue(evidence)
        self.assertTrue(citation_owners)

    def test_incomplete_audit_details_use_required_unique_slots(self):
        coverage = valid_coverage()
        audit = provider_audit_core(coverage)
        evidence = cv.build_existing_evidence_checks(
            coverage, SCREENPLAY_TEXT
        )
        normalized_audit = cv.normalize_audit_tool_input(
            copy.deepcopy(audit), range(1, 7)
        )
        rows = cv.build_detail_audit_rows(
            coverage, evidence, normalized_audit["sequence_ledger"]
        )
        detail_payload = supported_detail_payload(coverage)
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (audit, settled_usage()),
                (detail_payload, settled_usage()),
            ]
        )

        report, usage = run_engine(new_store(), transport)

        self.assertEqual(len(transport.calls), 3)
        detail_tool = transport.calls[2]["tool"]
        self.assertEqual(detail_tool["name"], "submit_detail_audit_v1_2")
        result_schema = detail_tool["input_schema"]
        slots = [row["slot"] for row in rows]
        returned_slots = [
            slot
            for group in result_schema["properties"].values()
            for slot in group["items"]["properties"]["slot"]["enum"]
        ]
        self.assertEqual(
            set(result_schema["required"]),
            {cv._detail_result_group(row) for row in rows},
        )
        self.assertEqual(returned_slots, slots)
        self.assertLessEqual(
            cv.strict_schema_complexity(detail_tool["input_schema"])[
                "property_count"
            ],
            cv.STRICT_BUDGET["property_count"],
        )
        self.assertEqual(
            [row["field_path"] for row in report["fact_audit"][
                "existing_evidence_verdicts"
            ]],
            [check["field_path"] for check in evidence],
        )
        self.assertEqual(
            [row["owner"] for row in report["fact_audit"][
                "citation_relevance"
            ]],
            [owner for owner, _item in cv._iter_citations(coverage)],
        )
        self.assertEqual(usage["call_count"], 3)

    def test_primary_typed_detail_arrays_seal_without_format_retry(self):
        coverage = valid_coverage()
        audit = provider_audit_core(coverage)
        source = SCREENPLAY_TEXT
        normalized = cv.normalize_audit_tool_input(
            copy.deepcopy(audit), range(1, 7)
        )
        rows = cv.build_detail_audit_rows(
            coverage,
            cv.build_existing_evidence_checks(coverage, source),
            normalized["sequence_ledger"],
        )
        transport = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (typed_detail_payload_for_rows(rows, source), settled_usage()),
        ])

        report, usage = run_engine(new_store(), transport, text=source)

        self.assertEqual(report["status"], "sealed")
        self.assertEqual(usage["call_count"], 3)
        self.assertEqual(len(transport.calls), 3)
        self.assertEqual(
            set(transport.calls[2]["tool"]["input_schema"]["properties"]),
            {cv._detail_result_group(row) for row in rows},
        )

    def test_grounded_transport_uses_bound_citations_and_fixed_sequence_fields(self):
        coverage = valid_coverage()
        audit = cv.normalize_audit_tool_input(
            provider_audit_core(coverage), range(1, 7)
        )
        rows = cv.build_detail_audit_rows(
            coverage,
            cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT),
            audit["sequence_ledger"],
        )
        citation_row = next(
            row for row in rows if row["kind"] == "citation_relevance"
        )
        sequence_row = next(
            row for row in rows if row["kind"] == "sequence_evidence"
        )
        count_row = {
            "slot": "row_998",
            "kind": "existing_evidence",
            "identifier": "synthetic.count",
            "subject": {"trigger": "counting_claim"},
        }
        schema = cv.build_detail_audit_tool([
            count_row, citation_row, sequence_row,
        ])["input_schema"]["properties"]

        self.assertEqual(
            set(schema["citation_results"]["items"]["properties"]),
            {"slot", "supports", "note"},
        )
        self.assertEqual(
            set(schema["count_results"]["items"]["properties"]),
            {"slot", "instances"},
        )
        self.assertNotIn(
            "label",
            schema["count_results"]["items"]["properties"]["instances"][
                "items"
            ]["properties"],
        )
        sequence_group = cv._detail_result_group(sequence_row)
        sequence_properties = schema[sequence_group]["items"][
            "properties"
        ]
        self.assertNotIn("checks", sequence_properties)
        self.assertNotIn("observed_actors", sequence_properties)
        self.assertIn("actor_source_id", sequence_properties)
        self.assertNotIn("actor_page", sequence_properties)
        self.assertNotIn("actor_excerpt", sequence_properties)
        self.assertNotIn("unsupported_fields", sequence_properties)
        self.assertIn("character_knowledge_status", sequence_properties)

        payload = typed_detail_payload_for_rows([
            citation_row, sequence_row,
        ])
        expanded = cv._expand_detail_audit_payload(
            payload, [citation_row, sequence_row]
        )["results"]
        self.assertEqual(
            expanded[citation_row["slot"]]["checks"][0],
            {
                "field": "citation",
                "page": citation_row["subject"]["page"],
                "excerpt": citation_row["subject"]["excerpt"],
                "supports": True,
            },
        )
        self.assertEqual(
            [check["field"] for check in expanded[sequence_row["slot"]][
                "checks"
            ]],
            sequence_row["subject"]["required_fields"],
        )

    def test_fixed_sequence_transport_rejects_a_missing_required_scalar(self):
        coverage = valid_coverage()
        audit = cv.normalize_audit_tool_input(
            provider_audit_core(coverage), range(1, 7)
        )
        row = next(
            row for row in cv.build_detail_audit_rows(
                coverage,
                cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT),
                audit["sequence_ledger"],
            )
            if row["kind"] == "sequence_evidence"
        )
        payload = typed_detail_payload_for_rows([row])
        group = cv._detail_result_group(row)
        payload[group][0].pop("result_source_id")

        expanded = cv._expand_detail_audit_payload(payload, [row])

        self.assertIsNone(expanded["results"][row["slot"]])

    def test_fixed_sequence_transport_rejects_single_actor_substitution(self):
        source = (
            "[PAGE 1]\nCarlos performs the song.\nDiego performs the dance.\n"
            "The audience applauds.\nThe audience sees Diego perform."
        )
        anchors = cv._source_anchor_catalog(source)
        source_id = lambda words: next(  # noqa: E731
            key for key, value in anchors.items()
            if words in value["excerpt"]
        )
        row = {
            "slot": "row_001",
            "kind": "sequence_evidence",
            "identifier": "sequence_ledger[1]",
            "subject": {
                "beat": {
                    "order": 1,
                    "phase": "climax",
                    "page": 1,
                    "actor": "Diego",
                    "action": "Diego performs the dance.",
                    "result": "The audience applauds.",
                    "character_knowledge": "NOT LOCATED",
                    "audience_knowledge": "The audience sees Diego perform.",
                },
                "required_fields": [
                    "actor", "action", "result", "audience_knowledge",
                ],
                "claim_sha256": "a" * 64,
            },
        }
        payload = {
            "sequence_results": [{
                "slot": row["slot"],
                "classification": "supported",
                "note": "Every claimed field is staged.",
                "actor_source_id": (
                    f"{row['slot']}:actor:{source_id('Carlos performs')}"
                ),
                "action_source_id": (
                    f"{row['slot']}:action:{source_id('Diego performs')}"
                ),
                "result_source_id": (
                    f"{row['slot']}:result:{source_id('audience applauds')}"
                ),
                "audience_knowledge_source_id": (
                    f"{row['slot']}:audience_knowledge:"
                    f"{source_id('audience sees Diego')}"
                ),
                "character_knowledge_status": "not_required",
            }],
        }

        expanded = cv._expand_detail_audit_payload(payload, [row])
        decoded, reason = cv._decode_grounded_detail_value(
            expanded["results"][row["slot"]], row, source
        )

        self.assertIsNone(decoded)
        self.assertIn("Diego", str(reason))

    def test_fixed_sequence_transport_rejects_actor_only_knowledge_excerpt(self):
        source = (
            "[PAGE 1]\nDiego enters the room.\nThe audience sees Diego enter.\n"
            "Later, Diego knows Carlos stole the money."
        )
        anchors = cv._source_anchor_catalog(source)
        enters_id = next(
            key for key, value in anchors.items()
            if "Diego enters" in value["excerpt"]
        )
        audience_id = next(
            key for key, value in anchors.items()
            if "audience sees" in value["excerpt"]
        )
        row = {
            "slot": "row_001",
            "kind": "sequence_evidence",
            "identifier": "sequence_ledger[0]",
            "subject": {
                "beat": {
                    "order": 1,
                    "phase": "climax",
                    "page": 1,
                    "actor": "Diego",
                    "action": "Diego enters the room.",
                    "result": "Diego enters the room.",
                    "character_knowledge": (
                        "Diego knows Carlos stole the money."
                    ),
                    "audience_knowledge": (
                        "The audience sees Diego enter the room."
                    ),
                },
                "required_fields": list(cv.GROUNDED_SEQUENCE_FIELDS),
                "claim_sha256": "a" * 64,
            },
        }
        payload = {
            "sequence_knowledge_results": [{
                "slot": row["slot"],
                "classification": "supported",
                "note": "The chosen excerpt stages Diego's knowledge.",
                "actor_source_id": f"{row['slot']}:actor:{enters_id}",
                "action_source_id": f"{row['slot']}:action:{enters_id}",
                "result_source_id": f"{row['slot']}:result:{enters_id}",
                "character_knowledge_source_id": (
                    f"{row['slot']}:character_knowledge:{enters_id}"
                ),
                "audience_knowledge_source_id": (
                    f"{row['slot']}:audience_knowledge:{audience_id}"
                ),
                "character_knowledge_status": "checked",
            }],
        }

        expanded = cv._expand_detail_audit_payload(payload, [row])
        decoded, reason = cv._decode_grounded_detail_value(
            expanded["results"][row["slot"]], row, source
        )

        self.assertIsNone(decoded)
        self.assertTrue(
            "does not prove its atomic fact" in str(reason)
            or "is not staged" in str(reason),
            reason,
        )

    def test_count_transport_derives_totals_and_accepts_exact_two_word_anchor(self):
        source = "[PAGE 1]\nLlega Lucesita"
        row = {
            "slot": "row_001",
            "kind": "existing_evidence",
            "identifier": "story_spine.turning_points[0]",
            "subject": {
                "trigger": "counting_claim",
                "claim": "One member arrives.",
                "claimed_total": 1,
                "claimed_universe_total": 1,
                "count_quantifier": "exact",
            },
        }
        payload = {
            "count_results": [{
                "slot": row["slot"],
                "instances": [{
                    "source_id": "p001-l001",
                    "matches_claim": True,
                    "multiplicity": 1,
                }],
            }],
        }

        expanded = cv._expand_detail_audit_payload(payload, [row])
        evidence, _citations = cv.decode_detail_audit_payload(
            expanded, [row], source
        )
        ledger = evidence[0]["count_ledger"]

        self.assertEqual(evidence[0]["classification"], "supported")
        self.assertEqual(ledger["observed_total"], 1)
        self.assertEqual(ledger["observed_universe_total"], 1)
        self.assertRegex(
            ledger["instances"][0]["source_instance_id"], r"^[0-9a-f]{64}$"
        )
        unknown = copy.deepcopy(payload)
        unknown["count_results"][0]["instances"][0]["source_id"] = (
            "p001-l999"
        )
        unknown_expanded = cv._expand_detail_audit_payload(unknown, [row])
        unknown_evidence, _ = cv.decode_detail_audit_payload(
            unknown_expanded, [row], source
        )
        self.assertFalse(unknown_evidence[0]["count_ledger"]["valid"])
        self.assertIn(
            "source_id is unknown",
            unknown_evidence[0]["count_ledger"]["reason"],
        )
        inflated_row = copy.deepcopy(row)
        inflated_row["subject"].update({
            "claim": "Five members arrive.",
            "claimed_total": 5,
            "claimed_universe_total": 5,
            "count_entity": "members",
        })
        inflated_payload = copy.deepcopy(payload)
        inflated_payload["count_results"][0]["instances"][0][
            "multiplicity"
        ] = 5
        inflated = cv._expand_detail_audit_payload(
            inflated_payload, [inflated_row]
        )
        inflated_evidence, _ = cv.decode_detail_audit_payload(
            inflated, [inflated_row], source
        )
        self.assertFalse(inflated_evidence[0]["count_ledger"]["valid"])
        self.assertIn(
            "multiplicity is not explicitly proved",
            inflated_evidence[0]["count_ledger"]["reason"],
        )

    def test_spanish_numbered_judges_use_engine_bound_source_ids(self):
        source = """\
[PAGE 94]
Vemos al primer Juez
Es turno del segundo Juez
El tercer Juez alza su paleta
[PAGE 95]
Última calificación aunque ya no importa
El Juez sonríe antes de dar su calificación
[PAGE 96]
Un quinto Juez protesta
"""
        subject = {
            "trigger": "counting_claim",
            "claim": "Exactly 4 judges perform this action.",
            "claimed_total": 4,
            "claimed_universe_total": 4,
            "count_quantifier": "exact",
            "count_entity": "judges",
            "require_distinct_instances": True,
            "claimed_role_identities": [1, 2, 3, 4],
            "distinct_role_terms": ["judge", "juez", "jueza"],
            "collective_role_terms": ["judges", "jueces", "juezas"],
            "allowed_pages": [94, 95],
        }
        row = {
            "slot": "row_001",
            "kind": "existing_evidence",
            "identifier": "sequence_ledger[7].action#numbered_role_count",
            "subject": subject,
        }
        anchors = cv._source_anchor_catalog(source)

        def source_id(words: str) -> str:
            return next(
                key for key, value in anchors.items()
                if words in value["excerpt"]
            )

        ids = [
            source_id("primer Juez"),
            source_id("segundo Juez"),
            source_id("tercer Juez"),
            source_id("El Juez sonríe"),
        ]

        def decode(source_ids: list[str]) -> dict:
            payload = {"count_results": [{
                "slot": row["slot"],
                "instances": [
                    {
                        "source_id": anchor_id,
                        "matches_claim": True,
                        "multiplicity": 1,
                    }
                    for anchor_id in source_ids
                ],
            }]}
            expanded = cv._expand_detail_audit_payload(payload, [row])
            evidence, _ = cv.decode_detail_audit_payload(
                expanded, [row], source
            )
            return evidence[0]

        accepted = decode(ids)
        self.assertEqual(accepted["classification"], "supported")
        self.assertEqual(
            {
                instance["source_identity"]
                for instance in accepted["count_ledger"]["instances"]
            },
            {"role:1", "role:2", "role:3", "role:unlabeled"},
        )
        self.assertNotEqual(decode(ids[:3])["classification"], "supported")
        self.assertFalse(
            decode([*ids, ids[-1]])["count_ledger"]["valid"]
        )
        self.assertFalse(
            decode([*ids[:3], source_id("quinto Juez")])["count_ledger"]["valid"]
        )

    def test_two_word_engine_anchor_can_ground_cantan_otra(self):
        source = """\
[PAGE 101]
Los Cosquillitas siguen juntos
Cantan otra
El público pide otra canción
"""
        row = {
            "slot": "row_001",
            "kind": "sequence_evidence",
            "identifier": "sequence_ledger[20]",
            "subject": {
                "beat": {
                    "order": 20,
                    "phase": "final_scene",
                    "page": 101,
                    "actor": "Los Cosquillitas",
                    "action": "Los Cosquillitas cantan otra.",
                    "result": "El público pide otra canción.",
                    "character_knowledge": "NOT LOCATED",
                    "audience_knowledge": "El público pide otra canción.",
                },
                "required_fields": [
                    "actor", "action", "result", "audience_knowledge",
                ],
                "claim_sha256": "a" * 64,
            },
        }
        anchors = cv._source_anchor_catalog(source)
        by_excerpt = {
            value["excerpt"]: key for key, value in anchors.items()
        }
        anchored = {
            "classification": "supported",
            "checks": [
                {
                    "field": "actor",
                    "source_id": (
                        f"{row['slot']}:actor:"
                        f"{by_excerpt['Los Cosquillitas siguen juntos']}"
                    ),
                    "supports": True,
                },
                {
                    "field": "action",
                    "source_id": (
                        f"{row['slot']}:action:{by_excerpt['Cantan otra']}"
                    ),
                    "supports": True,
                },
                {
                    "field": "result",
                    "source_id": (
                        f"{row['slot']}:result:"
                        f"{by_excerpt['El público pide otra canción']}"
                    ),
                    "supports": True,
                },
                {
                    "field": "audience_knowledge",
                    "source_id": (
                        f"{row['slot']}:audience_knowledge:"
                        f"{by_excerpt['El público pide otra canción']}"
                    ),
                    "supports": True,
                },
            ],
            "note": "The final encore is literally staged.",
        }
        decoded, reason = cv._decode_grounded_detail_value(
            anchored, row, source
        )
        self.assertIsNotNone(decoded, reason)
        free_text = copy.deepcopy(anchored)
        free_text["checks"][1] = {
            "field": "action",
            "page": 101,
            "excerpt": "Cantan otra",
            "supports": True,
        }
        decoded, reason = cv._decode_grounded_detail_value(
            free_text, row, source
        )
        self.assertIsNone(decoded)
        self.assertIn("3-12 words", str(reason))

    def test_real_cosquillitas_finale_keeps_structural_subject_inheritance(self):
        source = "[PAGE 101]\n" + "\n".join([
            "Juanito prepara el encore con el grupo.",
            *("Relleno continuo de la escena." for _ in range(11)),
            "Otra! Otra! Otra!",
            "Los Cosquillitas están felices",
            "JUANITO",
            "Por que ustedes lo pidieron esta",
            "cancíon se llama “Otra!”",
            "Cantan otra",
        ])
        row = {
            "slot": "row_001",
            "kind": "sequence_evidence",
            "identifier": "sequence_ledger[20]",
            "subject": {
                "beat": {
                    "order": 20,
                    "phase": "final_scene",
                    "page": 101,
                    "actor": "Cosquillitas",
                    "action": (
                        "Perform encores of theme song and new song 'Otra!' "
                        "for celebrating crowd"
                    ),
                    "result": (
                        "Screenplay concludes with group in triumph on stage"
                    ),
                    "character_knowledge": "NOT LOCATED",
                    "audience_knowledge": (
                        "The comeback is complete and Cosquillitas are restored "
                        "as beloved stars"
                    ),
                },
                "required_fields": [
                    "actor", "action", "result", "audience_knowledge",
                ],
                "claim_sha256": "a" * 64,
            },
        }
        anchors = cv._source_anchor_catalog(source)

        def token(field: str, fragment: str) -> str:
            anchor_id = next(
                key for key, value in anchors.items()
                if fragment in value["excerpt"]
            )
            return f"{row['slot']}:{field}:{anchor_id}"

        value = {
            "classification": "supported",
            "checks": [
                {
                    "field": "actor",
                    "source_id": token("actor", "Cosquillitas están felices"),
                    "supports": True,
                },
                {
                    "field": "action",
                    "source_id": token("action", "Cantan otra"),
                    "supports": True,
                },
                {
                    "field": "result",
                    "source_id": token("result", "Cantan otra"),
                    "supports": True,
                },
                {
                    "field": "audience_knowledge",
                    "source_id": token("audience_knowledge", "Otra! Otra! Otra"),
                    "supports": True,
                },
            ],
            "note": "The final scene stages the group encore and public demand.",
        }

        decoded, reason = cv._decode_grounded_detail_value(value, row, source)

        self.assertIsNotNone(decoded, reason)

    def test_sequence_action_anchor_rejects_object_and_scene_boundary(self):
        cases = (
            (
                "generic actor used as an object",
                "[PAGE 1]\nDante bribes the judges during the contest.\n",
                "The judges",
                "The judges award Diego the trophy.",
                "Dante bribes the judges",
                None,
            ),
            (
                "named actor used as an object",
                "[PAGE 1]\nCarlos attacks Diego during the contest.\n",
                "Diego",
                "Diego wins the contest.",
                "Carlos attacks Diego",
                None,
            ),
            (
                "named actor used as a prepositional coactor",
                "[PAGE 1]\nWith Diego, Carlos wins the race.\n",
                "Diego",
                "Diego wins the race.",
                "With Diego, Carlos wins the race",
                "With Diego, Carlos wins the race",
            ),
            (
                "scene boundary between actor and action",
                (
                    "[PAGE 1]\nDiego waits by the gate.\n"
                    "INT. VAULT - NIGHT\nThe vault explodes around everyone.\n"
                ),
                "Diego",
                "Diego triggers the vault explosion.",
                "Diego waits by the gate",
                "The vault explodes around everyone",
            ),
            (
                "compatible group intervenes before an omitted subject",
                (
                    "[PAGE 1]\nLos Cosquillitas están felices.\n"
                    "The rival team enters the stage.\nCantan otra.\n"
                ),
                "Cosquillitas",
                "Perform an encore.",
                "Los Cosquillitas están felices",
                "Cantan otra",
            ),
            (
                "generic singular actor intervenes before an omitted subject",
                (
                    "[PAGE 1]\nDiego waits by the gate.\n"
                    "The goalkeeper takes position.\nOpens the wooden door.\n"
                ),
                "Diego",
                "Diego opens the wooden door.",
                "Diego waits by the gate",
                "Opens the wooden door",
            ),
            (
                "lowercase independent clauses break action inheritance",
                (
                    "[PAGE 1]\nDiego waits by the gate.\n"
                    "rain fills the empty street.\n"
                    "wind shakes the old windows.\n"
                    "Opens the wooden door.\n"
                ),
                "Diego",
                "Diego opens the wooden door.",
                "Diego waits by the gate",
                "Opens the wooden door",
            ),
            *(
                (
                    f"claimed actor is only a {relation} participant",
                    (
                        "[PAGE 1]\nDiego waits by the door.\n"
                        f"Opens the red door {relation} Diego {verb}.\n"
                    ),
                    "Diego",
                    "Diego opens the red door.",
                    "Diego waits by the door",
                    "Opens the red door",
                )
                for relation, verb in (
                    ("after", "leaves"),
                    ("while", "watches"),
                    ("before", "arrives"),
                )
            ),
            (
                "dialogue bridge is bounded to two continuation lines",
                (
                    "[PAGE 1]\nLos Cosquillitas esperan juntos.\n"
                    "JUANITO\nPrimera línea de diálogo.\n"
                    "Segunda línea de diálogo.\nTercera línea de diálogo.\n"
                    "Cantan otra canción juntos.\n"
                ),
                "Cosquillitas",
                "Cosquillitas cantan otra canción juntos.",
                "Los Cosquillitas esperan juntos",
                "Cantan otra canción juntos",
            ),
            (
                "dialogue cue without dialogue cannot bridge actors",
                (
                    "[PAGE 1]\nJuanito prepara la siguiente canción.\n"
                    "Los Cosquillitas esperan juntos.\nJUANITO\n"
                    "Cantan otra canción juntos.\n"
                ),
                "Cosquillitas",
                "Cosquillitas cantan otra canción juntos.",
                "Los Cosquillitas esperan juntos",
                "Cantan otra canción juntos",
            ),
            *(
                (
                    f"{marker} is not a dialogue cue",
                    (
                        "[PAGE 1]\nDiego waits by the gate.\n"
                        f"{marker}\nOpens the wooden door.\n"
                    ),
                    "Diego",
                    "Diego opens the wooden door.",
                    "Diego waits by the gate",
                    "Opens the wooden door",
                )
                for marker in (
                    "ONE HOUR LATER", "CUT TO", "TITLE CARD", "FLASHBACK",
                    "INTERCUT", "MONTAGE", "SUPER",
                )
            ),
            *(
                (
                    f"dialogue bridge cannot hide {intervening}",
                    (
                        "[PAGE 1]\nJuanito prepara la siguiente canción.\n"
                        "Los Cosquillitas esperan juntos.\nJUANITO\n"
                        f"{intervening}\nCantan otra canción juntos.\n"
                    ),
                    "Cosquillitas",
                    "Cosquillitas cantan otra canción juntos.",
                    "Los Cosquillitas esperan juntos",
                    "Cantan otra canción juntos",
                )
                for intervening in (
                    "Carlos fires the gun.",
                    "And Carlos fires the gun.",
                    "The rival team takes the stage.",
                    "Los rivales toman el escenario.",
                    "Y Carlos dispara el arma.",
                )
            ),
        )
        for label, source, actor, action, actor_excerpt, action_excerpt in cases:
            with self.subTest(label):
                row = {
                    "slot": "row_001",
                    "kind": "sequence_evidence",
                    "identifier": "sequence_ledger[0]",
                    "subject": {
                        "beat": {
                            "order": 1,
                            "phase": "climax",
                            "page": 1,
                            "actor": actor,
                            "action": action,
                            "result": "NOT LOCATED",
                            "character_knowledge": "NOT LOCATED",
                            "audience_knowledge": "NOT LOCATED",
                        },
                        "required_fields": ["actor", "action"],
                        "claim_sha256": "a" * 64,
                    },
                }
                anchors = cv._source_anchor_catalog(source)

                def token(field: str, fragment: str) -> str:
                    anchor_id = next(
                        key for key, value in anchors.items()
                        if fragment in value["excerpt"]
                    )
                    return f"{row['slot']}:{field}:{anchor_id}"

                value = {
                    "classification": (
                        "supported" if action_excerpt else "partially_supported"
                    ),
                    "checks": [
                        {
                            "field": "actor",
                            "source_id": token("actor", actor_excerpt),
                            "supports": True,
                        },
                        {
                            "field": "action",
                            "source_id": (
                                token("action", action_excerpt)
                                if action_excerpt
                                else cv.SEQUENCE_SOURCE_NOT_LOCATED
                            ),
                            "supports": bool(action_excerpt),
                        },
                    ],
                    "note": "The source supports both frozen fields.",
                }

                decoded, reason = cv._decode_grounded_detail_value(
                    value, row, source
                )

                self.assertIsNone(decoded)
                self.assertIsNotNone(reason)

    def test_sequence_result_and_audience_require_field_relevance(self):
        cases = (
            (
                (
                    "[PAGE 1]\nDiego opens the vault door.\n"
                    "The hallway remains completely empty.\n"
                    "The weather is pleasant today.\n"
                ),
                "Diego opens the vault door.",
                "Diego wins the contest.",
                "The audience sees Diego win.",
                {
                    "actor": "Diego opens the vault door",
                    "action": "Diego opens the vault door",
                    "result": "hallway remains completely empty",
                    "audience_knowledge": "weather is pleasant today",
                },
            ),
            (
                "[PAGE 1]\nDiego opens the window.\n",
                "Diego opens the vault.",
                "NOT LOCATED",
                "NOT LOCATED",
                {
                    "actor": "Diego opens the window",
                    "action": "Diego opens the window",
                },
            ),
            (
                "[PAGE 1]\nDiego opens the heavy red window.\n",
                "Diego opens the heavy red vault.",
                "NOT LOCATED",
                "NOT LOCATED",
                {
                    "actor": "Diego opens the heavy red window",
                    "action": "Diego opens the heavy red window",
                },
            ),
            (
                "[PAGE 1]\nDiego closes the heavy red vault door.\n",
                "Diego opens the heavy red vault door.",
                "NOT LOCATED",
                "NOT LOCATED",
                {
                    "actor": "Diego closes the heavy red vault door",
                    "action": "Diego closes the heavy red vault door",
                },
            ),
            (
                "[PAGE 1]\nDiego exits from the crowded arena.\n",
                "Diego enters the crowded arena.",
                "NOT LOCATED",
                "NOT LOCATED",
                {
                    "actor": "Diego exits from the crowded arena",
                    "action": "Diego exits from the crowded arena",
                },
            ),
            (
                "[PAGE 1]\nDiego cierra la pesada puerta roja.\n",
                "Diego abre la pesada puerta roja.",
                "NOT LOCATED",
                "NOT LOCATED",
                {
                    "actor": "Diego cierra la pesada puerta roja",
                    "action": "Diego cierra la pesada puerta roja",
                },
            ),
            (
                "[PAGE 1]\nDiego opens the vault door.\n",
                "Diego murders Carlos behind the theater.",
                "NOT LOCATED",
                "NOT LOCATED",
                {
                    "actor": "Diego opens the vault door",
                    "action": "Diego opens the vault door",
                },
            ),
            (
                "[PAGE 1]\nDiego loses the final bicycle race.\n",
                "Diego loses the final bicycle race.",
                "Diego wins the final bicycle race.",
                "NOT LOCATED",
                {
                    "actor": "Diego loses the final bicycle race",
                    "action": "Diego loses the final bicycle race",
                    "result": "Diego loses the final bicycle race",
                },
            ),
            (
                "[PAGE 1]\nDiego does not open the heavy vault door.\n",
                "Diego opens the heavy vault door.",
                "NOT LOCATED",
                "NOT LOCATED",
                {
                    "actor": "Diego does not open the heavy vault door",
                    "action": "Diego does not open the heavy vault door",
                },
            ),
            (
                (
                    "[PAGE 1]\nDiego wins the race.\n"
                    "The audience applauds wildly.\n"
                ),
                "Diego wins the race.",
                "NOT LOCATED",
                "The audience learns Carlos cheated.",
                {
                    "actor": "Diego wins the race",
                    "action": "Diego wins the race",
                    "audience_knowledge": "audience applauds wildly",
                },
            ),
            (
                (
                    "[PAGE 1]\nDiego wins the race.\n"
                    "The audience sees the camera.\n"
                ),
                "Diego wins the race.",
                "NOT LOCATED",
                "The audience sees Diego win.",
                {
                    "actor": "Diego wins the race",
                    "action": "Diego wins the race",
                    "audience_knowledge": "audience sees the camera",
                },
            ),
            (
                (
                    "[PAGE 1]\nDiego reaches the trophy ceremony.\n"
                    "Carlos receives the trophy beside Diego.\n"
                ),
                "Diego reaches the trophy ceremony.",
                "Diego receives the trophy.",
                "NOT LOCATED",
                {
                    "actor": "Diego reaches the trophy ceremony",
                    "action": "Diego reaches the trophy ceremony",
                    "result": "Carlos receives the trophy beside Diego",
                },
            ),
            (
                (
                    "[PAGE 1]\nDiego wins the final race.\n"
                    "The golden trophy breaks.\n"
                ),
                "Diego wins the final race.",
                "Diego receives the golden trophy.",
                "NOT LOCATED",
                {
                    "actor": "Diego wins the final race",
                    "action": "Diego wins the final race",
                    "result": "golden trophy breaks",
                },
            ),
            (
                (
                    "[PAGE 1]\nDiego gana la carrera final.\n"
                    "El trofeo dorado se rompe.\n"
                ),
                "Diego gana la carrera final.",
                "Diego recibe el trofeo dorado.",
                "NOT LOCATED",
                {
                    "actor": "Diego gana la carrera final",
                    "action": "Diego gana la carrera final",
                    "result": "trofeo dorado se rompe",
                },
            ),
            (
                (
                    "[PAGE 1]\nDiego reaches the trophy ceremony.\n"
                    "The audience applauds Carlos receiving the trophy "
                    "beside Diego.\n"
                ),
                "Diego reaches the trophy ceremony.",
                "NOT LOCATED",
                "The audience applauds Diego receiving the trophy.",
                {
                    "actor": "Diego reaches the trophy ceremony",
                    "action": "Diego reaches the trophy ceremony",
                    "audience_knowledge": (
                        "audience applauds Carlos receiving the trophy"
                    ),
                },
            ),
            (
                (
                    "[PAGE 1]\nDiego wins the race.\n"
                    "The audience applauds Diego loudly.\n"
                ),
                "Diego wins the race.",
                "NOT LOCATED",
                "The audience celebrates Carlos victory.",
                {
                    "actor": "Diego wins the race",
                    "action": "Diego wins the race",
                    "audience_knowledge": "audience applauds Diego loudly",
                },
            ),
            (
                (
                    "[PAGE 1]\nDiego sings on the main stage.\n"
                    "The audience boos Diego loudly.\n"
                ),
                "Diego sings on the main stage.",
                "NOT LOCATED",
                "Diego is restored as a beloved star.",
                {
                    "actor": "Diego sings on the main stage",
                    "action": "Diego sings on the main stage",
                    "audience_knowledge": "audience boos Diego loudly",
                },
            ),
            (
                (
                    "[PAGE 1]\nLos Cosquillitas esperan juntos.\n"
                    "Pierden el concurso decisivo.\n"
                ),
                "Cosquillitas pierden el concurso decisivo.",
                "Screenplay concludes with group in triumph on stage.",
                "NOT LOCATED",
                {
                    "actor": "Los Cosquillitas esperan juntos",
                    "action": "Pierden el concurso decisivo",
                    "result": "Pierden el concurso decisivo",
                },
            ),
            (
                (
                    "[PAGE 1]\nLos Cosquillitas están felices.\n"
                    "Cantan otra canción juntos.\n"
                ),
                "Cosquillitas cantan otra canción juntos.",
                "Screenplay concludes with group receiving the trophy.",
                "NOT LOCATED",
                {
                    "actor": "Los Cosquillitas están felices",
                    "action": "Cantan otra canción juntos",
                    "result": "Cantan otra canción juntos",
                },
            ),
            (
                (
                    "[PAGE 1]\nDiego opens the old vault.\n"
                    "Carlos wins the final contest.\n"
                    "Receives the silver trophy.\n"
                ),
                "Diego opens the old vault.",
                "Diego receives the silver trophy.",
                "NOT LOCATED",
                {
                    "actor": "Diego opens the old vault",
                    "action": "Diego opens the old vault",
                    "result": "Receives the silver trophy",
                },
            ),
            (
                (
                    "[PAGE 1]\nDiego enters the final contest.\n"
                    "Diego wins the bicycle race.\n"
                ),
                "Diego enters the final contest.",
                "Diego wins the cash lottery.",
                "NOT LOCATED",
                {
                    "actor": "Diego enters the final contest",
                    "action": "Diego enters the final contest",
                    "result": "Diego wins the bicycle race",
                },
            ),
            (
                (
                    "[PAGE 1]\nDiego loses the opening race.\n"
                    "The audience celebrates the championship trophy.\n"
                ),
                "Diego loses the opening race.",
                "NOT LOCATED",
                "The audience celebrates Diego's championship trophy.",
                {
                    "actor": "Diego loses the opening race",
                    "action": "Diego loses the opening race",
                    "audience_knowledge": (
                        "audience celebrates the championship trophy"
                    ),
                },
            ),
            (
                (
                    "[PAGE 1]\nDiego wins the opening race.\n"
                    "Carlos wins the championship trophy.\n"
                    "The audience celebrates the championship trophy.\n"
                ),
                "Diego wins the opening race.",
                "NOT LOCATED",
                (
                    "The audience celebrates Diego winning the championship "
                    "trophy."
                ),
                {
                    "actor": "Diego wins the opening race",
                    "action": "Diego wins the opening race",
                    "audience_knowledge": (
                        "audience celebrates the championship trophy"
                    ),
                },
            ),
            (
                (
                    "[PAGE 1]\nDiego greets Carlos at the theater.\n"
                    "The audience sees Diego murder Carlos at the theater.\n"
                ),
                "Diego greets Carlos at the theater.",
                "NOT LOCATED",
                "The audience sees Diego murder Carlos at the theater.",
                {
                    "actor": "Diego greets Carlos at the theater",
                    "action": "Diego greets Carlos at the theater",
                    "audience_knowledge": "audience sees Diego murder Carlos",
                },
            ),
            (
                (
                    "[PAGE 1]\nDiego opens the red door.\n"
                    "The audience sees Diego paint the red door.\n"
                ),
                "Diego opens the red door.",
                "NOT LOCATED",
                "The audience sees Diego paint the red door.",
                {
                    "actor": "Diego opens the red door",
                    "action": "Diego opens the red door",
                    "audience_knowledge": "audience sees Diego paint",
                },
            ),
            (
                (
                    "[PAGE 1]\nDiego gana la carrera.\n"
                    "El público ve a Diego perder la carrera.\n"
                ),
                "Diego gana la carrera.",
                "NOT LOCATED",
                "El público ve a Diego perder la carrera.",
                {
                    "actor": "Diego gana la carrera",
                    "action": "Diego gana la carrera",
                    "audience_knowledge": "público ve a Diego perder",
                },
            ),
        )
        for source, action, result, audience, excerpts in cases:
            with self.subTest(result=result):
                fields = list(excerpts)
                row = {
                    "slot": "row_001",
                    "kind": "sequence_evidence",
                    "identifier": "sequence_ledger[0]",
                    "subject": {
                        "beat": {
                            "order": 1,
                            "phase": "climax",
                            "page": 1,
                            "actor": "Diego",
                            "action": action,
                            "result": result,
                            "character_knowledge": "NOT LOCATED",
                            "audience_knowledge": audience,
                        },
                        "required_fields": fields,
                        "claim_sha256": "a" * 64,
                    },
                }
                anchors = cv._source_anchor_catalog(source)
                checks = []
                for field, fragment in excerpts.items():
                    anchor_id = next(
                        key for key, value in anchors.items()
                        if fragment in value["excerpt"]
                    )
                    checks.append({
                        "field": field,
                        "source_id": f"{row['slot']}:{field}:{anchor_id}",
                        "supports": True,
                    })
                decoded, reason = cv._decode_grounded_detail_value(
                    {
                        "classification": "supported",
                        "checks": checks,
                        "note": "Every field is claimed as supported.",
                    },
                    row,
                    source,
                )

                self.assertIsNone(decoded)
                self.assertIsNotNone(reason)

    def test_sequence_action_requires_the_complete_named_actor_roster(self):
        cases = (
            (
                "Diego and Carlos wait by the door.",
                "Diego opens the vault door.",
                "Diego and Carlos",
                "Diego and Carlos open the vault door.",
            ),
            (
                "Diego y Carlos esperan junto a la puerta.",
                "Diego abre la puerta de la bóveda.",
                "Diego y Carlos",
                "Diego y Carlos abren la puerta de la bóveda.",
            ),
        )
        for actor_line, action_line, actor, action in cases:
            with self.subTest(action_line=action_line):
                source = f"[PAGE 1]\n{actor_line}\n{action_line}\n"
                row = {
                    "slot": "row_001",
                    "kind": "sequence_evidence",
                    "identifier": "sequence_ledger[0]",
                    "subject": {
                        "beat": {
                            "order": 1,
                            "phase": "climax",
                            "page": 1,
                            "actor": actor,
                            "action": action,
                            "result": "NOT LOCATED",
                            "character_knowledge": "NOT LOCATED",
                            "audience_knowledge": "NOT LOCATED",
                        },
                        "required_fields": ["actor", "action"],
                        "claim_sha256": "a" * 64,
                    },
                }
                anchors = cv._source_anchor_catalog(source)

                def token(field: str, fragment: str) -> str:
                    anchor_id = next(
                        key for key, anchor in anchors.items()
                        if fragment in anchor["excerpt"]
                    )
                    return f"{row['slot']}:{field}:{anchor_id}"

                decoded, reason = cv._decode_grounded_detail_value(
                    {
                        "classification": "supported",
                        "checks": [
                            {
                                "field": "actor",
                                "source_id": token(
                                    "actor", actor_line.rstrip(".")
                                ),
                                "supports": True,
                            },
                            {
                                "field": "action",
                                "source_id": token(
                                    "action", action_line.rstrip(".")
                                ),
                                "supports": True,
                            },
                        ],
                        "note": "Only one member performs the frozen action.",
                    },
                    row,
                    source,
                )

                self.assertIsNone(decoded)
                self.assertIn("does not identify", str(reason))

    def test_collective_actor_anchors_preserve_english_and_spanish_number(self):
        for actor, excerpt in (
            ("The judges", "The judges raise the red card."),
            ("Los jueces", "Los jueces alzan la tarjeta roja."),
        ):
            with self.subTest(actor=actor):
                self.assertIsNone(
                    cv._sequence_anchor_actor_reason(
                        {"actor": actor}, "action", excerpt
                    )
                )
        for actor, excerpt in (
            ("The judges", "The judge raises the red card."),
            ("Los jueces", "El juez alza la tarjeta roja."),
            (
                "Diego and the judges",
                "Diego and the judge discuss the final result.",
            ),
            (
                "Diego y los jueces",
                "Diego y el juez discuten el resultado final.",
            ),
        ):
            with self.subTest(actor=actor):
                self.assertIn(
                    "roster does not match",
                    str(cv._sequence_anchor_actor_reason(
                        {"actor": actor}, "action", excerpt
                    )),
                )

    def test_sequence_classification_matches_field_decisions(self):
        source = "[PAGE 1]\nDiego opens the vault door.\n"
        row = {
            "slot": "row_001",
            "kind": "sequence_evidence",
            "identifier": "sequence_ledger[0]",
            "subject": {
                "beat": {
                    "order": 1,
                    "phase": "climax",
                    "page": 1,
                    "actor": "Diego",
                    "action": "Diego opens the vault door.",
                    "result": "NOT LOCATED",
                    "character_knowledge": "NOT LOCATED",
                    "audience_knowledge": "NOT LOCATED",
                },
                "required_fields": ["actor", "action"],
                "claim_sha256": "a" * 64,
            },
        }
        anchor_id = next(iter(cv._source_anchor_catalog(source)))

        def decode(classification: str, supported_fields: set[str]):
            return cv._decode_grounded_detail_value(
                {
                    "classification": classification,
                    "checks": [
                        {
                            "field": field,
                            "source_id": (
                                f"{row['slot']}:{field}:{anchor_id}"
                                if field in supported_fields
                                else cv.SEQUENCE_SOURCE_NOT_LOCATED
                            ),
                            "supports": field in supported_fields,
                        }
                        for field in ("actor", "action")
                    ],
                    "note": "Each decision must agree with the classification.",
                },
                row,
                source,
            )

        for classification, fields in (
            ("partially_supported", {"actor", "action"}),
            ("unsupported", {"actor", "action"}),
            ("contradicted", set()),
        ):
            with self.subTest(classification=classification, fields=fields):
                decoded, reason = decode(classification, fields)
                self.assertIsNone(decoded)
                self.assertIsNotNone(reason)
        for classification, fields in (
            ("supported", {"actor", "action"}),
            ("partially_supported", {"actor"}),
            ("unsupported", set()),
        ):
            with self.subTest(classification=classification, fields=fields):
                decoded, reason = decode(classification, fields)
                self.assertIsNotNone(decoded, reason)

    def test_character_knowledge_anchor_must_prove_the_atomic_fact(self):
        source = (
            "[PAGE 1]\nDiego opens the old vault door.\n"
            "Diego learns the weather has changed.\n"
        )
        row = {
            "slot": "row_001",
            "kind": "sequence_evidence",
            "identifier": "sequence_ledger[0]",
            "subject": {
                "beat": {
                    "order": 1,
                    "phase": "climax",
                    "page": 1,
                    "actor": "Diego",
                    "action": "Diego opens the old vault door.",
                    "result": "NOT LOCATED",
                    "character_knowledge": (
                        "Diego learns Carlos cheated in the contest."
                    ),
                    "audience_knowledge": "NOT LOCATED",
                },
                "required_fields": [
                    "actor", "action", "character_knowledge",
                ],
                "claim_sha256": "a" * 64,
            },
        }
        anchors = cv._source_anchor_catalog(source)

        def token(field: str, fragment: str) -> str:
            anchor_id = next(
                key for key, anchor in anchors.items()
                if fragment in anchor["excerpt"]
            )
            return f"{row['slot']}:{field}:{anchor_id}"

        decoded, reason = cv._decode_grounded_detail_value(
            {
                "classification": "supported",
                "checks": [
                    {
                        "field": "actor",
                        "source_id": token("actor", "Diego opens"),
                        "supports": True,
                    },
                    {
                        "field": "action",
                        "source_id": token("action", "Diego opens"),
                        "supports": True,
                    },
                    {
                        "field": "character_knowledge",
                        "source_id": token(
                            "character_knowledge", "Diego learns the weather"
                        ),
                        "supports": True,
                    },
                ],
                "note": "The selected line is claimed as knowledge evidence.",
            },
            row,
            source,
        )

        self.assertIsNone(decoded)
        self.assertIn("atomic fact", str(reason))

    def test_character_knowledge_preserves_knower_number_and_fact_roles(self):
        cases = (
            (
                "Diego and the judges discuss the result.",
                "The judge knows the result.",
                "Diego and the judges",
                "The judges know the result.",
            ),
            (
                "Diego y los jueces discuten el resultado.",
                "El juez conoce el resultado.",
                "Diego y los jueces",
                "Los jueces conocen el resultado.",
            ),
            (
                "Diego questions Carlos about the contest.",
                "Carlos knows Diego cheated in the contest.",
                "Diego and Carlos",
                "Diego knows Carlos cheated in the contest.",
            ),
            (
                "Diego interroga a Carlos sobre el concurso.",
                "Carlos sabe que Diego hizo trampa en el concurso.",
                "Diego y Carlos",
                "Diego sabe que Carlos hizo trampa en el concurso.",
            ),
        )
        for action, knowledge_source, actor, knowledge in cases:
            with self.subTest(knowledge_source=knowledge_source):
                source = f"[PAGE 1]\n{action}\n{knowledge_source}\n"
                row = {
                    "slot": "row_001",
                    "kind": "sequence_evidence",
                    "identifier": "sequence_ledger[0]",
                    "subject": {
                        "beat": {
                            "order": 1,
                            "phase": "climax",
                            "page": 1,
                            "actor": actor,
                            "action": action,
                            "result": "NOT LOCATED",
                            "character_knowledge": knowledge,
                            "audience_knowledge": "NOT LOCATED",
                        },
                        "required_fields": [
                            "actor", "action", "character_knowledge",
                        ],
                        "claim_sha256": "a" * 64,
                    },
                }
                anchors = cv._source_anchor_catalog(source)

                def token(field: str, fragment: str) -> str:
                    anchor_id = next(
                        key for key, anchor in anchors.items()
                        if fragment.rstrip(".") in anchor["excerpt"]
                    )
                    return f"{row['slot']}:{field}:{anchor_id}"

                decoded, reason = cv._decode_grounded_detail_value(
                    {
                        "classification": "supported",
                        "checks": [
                            {
                                "field": "actor",
                                "source_id": token("actor", action),
                                "supports": True,
                            },
                            {
                                "field": "action",
                                "source_id": token("action", action),
                                "supports": True,
                            },
                            {
                                "field": "character_knowledge",
                                "source_id": token(
                                    "character_knowledge", knowledge_source
                                ),
                                "supports": True,
                            },
                        ],
                        "note": "A singular knower cannot prove a plural claim.",
                    },
                    row,
                    source,
                )

                self.assertIsNone(decoded)
                self.assertIn("atomic fact", str(reason))

    def test_sequence_evidence_rejects_subject_object_role_reversals(self):
        cases = (
            {
                "actor": "Diego and Carlos",
                "action": "Diego pushes Carlos away from the trophy podium.",
                "field": "action",
                "source_action": (
                    "Carlos pushes Diego away from the trophy podium."
                ),
                "source_field": (
                    "Carlos pushes Diego away from the trophy podium."
                ),
            },
            {
                "actor": "Diego y Carlos",
                "action": "Diego empuja a Carlos lejos del podio del trofeo.",
                "field": "action",
                "source_action": (
                    "Carlos empuja a Diego lejos del podio del trofeo."
                ),
                "source_field": (
                    "Carlos empuja a Diego lejos del podio del trofeo."
                ),
            },
            {
                "actor": "Diego and Carlos",
                "action": "Diego pushes Carlos.",
                "field": "action",
                "source_action": "Carlos angrily pushes Diego.",
                "source_field": "Carlos angrily pushes Diego.",
            },
            {
                "actor": "Diego y Carlos",
                "action": "Diego empuja a Carlos.",
                "field": "action",
                "source_action": "Carlos violentamente empuja a Diego.",
                "source_field": "Carlos violentamente empuja a Diego.",
            },
            {
                "actor": "The judge and the runner",
                "action": "The judge awards the runner.",
                "field": "action",
                "source_action": "The runner quickly awards the judge.",
                "source_field": "The runner quickly awards the judge.",
            },
            {
                "actor": "Diego and Carlos",
                "action": "Diego awards Carlos.",
                "field": "action",
                "source_action": "Diego is awarded by Carlos.",
                "source_field": "Diego is awarded by Carlos.",
            },
            {
                "actor": "Diego and Carlos",
                "action": "Diego gives Carlos the trophy.",
                "field": "action",
                "source_action": "Diego is given the trophy by Carlos.",
                "source_field": "Diego is given the trophy by Carlos.",
            },
            {
                "actor": "Diego",
                "action": "Diego never opens the door.",
                "field": "action",
                "source_action": "Diego opens the door without hesitation.",
                "source_field": "Diego opens the door without hesitation.",
            },
            {
                "actor": "Diego",
                "action": "Diego nunca abre la puerta.",
                "field": "action",
                "source_action": "Diego abre la puerta sin dudar.",
                "source_field": "Diego abre la puerta sin dudar.",
            },
            {
                "actor": "Diego y Carlos",
                "action": "Diego no empuja a Carlos.",
                "field": "action",
                "source_action": "Diego empuja a Carlos pero no cae.",
                "source_field": "Diego empuja a Carlos pero no cae.",
            },
            {
                "actor": "Diego",
                "action": "Diego does not open the door.",
                "field": "action",
                "source_action": (
                    "Diego not only opens the door but closes it."
                ),
                "source_field": (
                    "Diego not only opens the door but closes it."
                ),
            },
            {
                "actor": "Diego",
                "action": "Diego no abre la puerta.",
                "field": "action",
                "source_action": (
                    "Diego no solo abre la puerta, tambien la cierra."
                ),
                "source_field": (
                    "Diego no solo abre la puerta, tambien la cierra."
                ),
            },
            *(
                {
                    "actor": "Diego",
                    "action": "Diego opens the door.",
                    "field": "action",
                    "source_action": source_action,
                    "source_field": source_action,
                }
                for source_action in (
                    "Diego cannot open the door.",
                    "Diego can't open the door.",
                    "Diego fails to open the door.",
                    "Diego is unable to open the door.",
                    "Diego refuses to open the door.",
                    "Diego fracasa al abrir la puerta.",
                    "Diego se niega a abrir la puerta.",
                    "Diego tries to open the door.",
                    "Diego almost opens the door.",
                    "Diego plans to open the door.",
                    "Diego threatens to open the door.",
                    "Diego pretends to open the door.",
                    "Diego may open the door.",
                    "Diego might open the door.",
                    "Diego could open the door.",
                    "Diego intenta abrir la puerta.",
                    "Diego casi abre la puerta.",
                    "Diego planea abrir la puerta.",
                )
            ),
            {
                "actor": "Diego",
                "action": "Diego pushes Carlos away from the trophy podium.",
                "field": "action",
                "source_action": (
                    "Diego pushes Ana away from the trophy podium."
                ),
                "source_field": (
                    "Diego pushes Ana away from the trophy podium."
                ),
            },
            {
                "actor": "Diego",
                "action": "Diego opens Carlos old locker near the field.",
                "field": "action",
                "source_action": "Diego opens the old locker near the field.",
                "source_field": "Diego opens the old locker near the field.",
            },
            {
                "actor": "The judge",
                "action": "The judge awards the runner the golden trophy.",
                "field": "action",
                "source_action": (
                    "The judge awards the referee the golden trophy."
                ),
                "source_field": (
                    "The judge awards the referee the golden trophy."
                ),
            },
            {
                "actor": "Diego",
                "action": "Diego gives Carlos the trophy.",
                "field": "action",
                "source_action": "Diego gives the trophy near Carlos.",
                "source_field": "Diego gives the trophy near Carlos.",
            },
            {
                "actor": "Diego",
                "action": "Diego entrega el trofeo a Carlos.",
                "field": "action",
                "source_action": "Diego entrega el trofeo junto a Carlos.",
                "source_field": "Diego entrega el trofeo junto a Carlos.",
            },
            {
                "actor": "The judge",
                "action": "The judge awards the runner.",
                "field": "action",
                "source_action": (
                    "The judge awards the trophy beside the runner."
                ),
                "source_field": (
                    "The judge awards the trophy beside the runner."
                ),
            },
            {
                "actor": "Diego",
                "action": "Diego arrests Carlos at the police station.",
                "field": "action",
                "source_action": (
                    "Diego greets Carlos at the police station."
                ),
                "source_field": (
                    "Diego greets Carlos at the police station."
                ),
            },
            {
                "actor": "Diego",
                "action": "Diego golpea a Carlos junto al escenario.",
                "field": "action",
                "source_action": (
                    "Diego abraza a Carlos junto al escenario."
                ),
                "source_field": (
                    "Diego abraza a Carlos junto al escenario."
                ),
            },
            {
                "actor": "Diego",
                "action": "Diego poisons Carlos during the theater gala.",
                "field": "action",
                "source_action": (
                    "Diego photographs Carlos during the theater gala."
                ),
                "source_field": (
                    "Diego photographs Carlos during the theater gala."
                ),
            },
            {
                "actor": "Diego",
                "action": "Diego opens the red door.",
                "field": "action",
                "source_action": "Diego paints the red door.",
                "source_field": "Diego paints the red door.",
            },
            {
                "actor": "Diego",
                "action": "Diego enters the old arena.",
                "field": "action",
                "source_action": "Diego cleans the old arena.",
                "source_field": "Diego cleans the old arena.",
            },
            {
                "actor": "Diego",
                "action": "Diego buys the red car.",
                "field": "action",
                "source_action": "Diego washes the red car.",
                "source_field": "Diego washes the red car.",
            },
            {
                "actor": "Diego",
                "action": "Diego abre la puerta roja.",
                "field": "action",
                "source_action": "Diego pinta la puerta roja.",
                "source_field": "Diego pinta la puerta roja.",
            },
            {
                "actor": "Diego and Carlos",
                "action": "Diego murders Carlos in the theater.",
                "field": "action",
                "source_action": "Diego saluda a Carlos en el teatro.",
                "source_field": "Diego saluda a Carlos en el teatro.",
            },
            {
                "actor": "Diego",
                "action": "Diego opens the heavy vault door.",
                "field": "action",
                "source_action": "Diego pinta la pesada puerta de la bóveda.",
                "source_field": "Diego pinta la pesada puerta de la bóveda.",
            },
            {
                "actor": "Diego",
                "action": "Diego reaches the trophy ceremony.",
                "field": "result",
                "claim": "Diego receives the golden trophy.",
                "source_field": (
                    "Beside Diego, Carlos receives the golden trophy."
                ),
            },
            {
                "actor": "The judge",
                "action": "The judge reaches the trophy ceremony.",
                "field": "result",
                "claim": "The judge awards the runner the golden trophy.",
                "source_field": (
                    "The runner awards the judge the golden trophy."
                ),
            },
            {
                "actor": "The judge",
                "action": "The judge reaches the trophy ceremony.",
                "field": "result",
                "claim": "The judge awards the runner the golden trophy.",
                "source_field": (
                    "The judge awards the referee the golden trophy."
                ),
            },
            {
                "actor": "Diego",
                "action": "Diego reaches the trophy ceremony.",
                "field": "result",
                "claim": "Carlos gives Diego the trophy.",
                "source_field": "Diego receives the trophy.",
            },
            {
                "actor": "Diego",
                "action": "Diego reaches the trophy ceremony.",
                "field": "result",
                "claim": "Carlos rescues Diego from the fire.",
                "source_field": "Diego escapes from the fire.",
            },
            {
                "actor": "Diego",
                "action": "Diego questions Carlos about the contest.",
                "field": "character_knowledge",
                "claim": "Diego learns Carlos cheated in the contest.",
                "source_field": (
                    "Diego learns from Carlos that Ana cheated in the contest."
                ),
            },
            {
                "actor": "Diego and Carlos",
                "action": "Diego questions Carlos about the contest.",
                "field": "character_knowledge",
                "claim": "Diego knows Carlos murdered Ana.",
                "source_field": "Diego knows Carlos greeted Ana.",
            },
            {
                "actor": "Diego y Carlos",
                "action": "Diego pregunta a Carlos sobre el concurso.",
                "field": "character_knowledge",
                "claim": "Diego sabe que Carlos golpeó a Ana.",
                "source_field": "Diego sabe que Carlos abrazó a Ana.",
            },
            {
                "actor": "Diego and Carlos",
                "action": "Diego questions Carlos about the contest.",
                "field": "character_knowledge",
                "claim": "Diego knows Carlos murdered Ana.",
                "source_field": "Diego sabe que Carlos saludó a Ana.",
            },
            {
                "actor": "Diego",
                "action": "Diego reaches the trophy ceremony.",
                "field": "audience_knowledge",
                "claim": "The audience applauds Diego receiving the trophy.",
                "source_field": (
                    "The audience applauds beside Diego as Carlos receives "
                    "the trophy."
                ),
            },
            {
                "actor": "The judge",
                "action": "The judge reaches the trophy ceremony.",
                "field": "audience_knowledge",
                "claim": (
                    "The audience applauds the judge awarding the runner "
                    "the trophy."
                ),
                "source_field": (
                    "The audience applauds the runner awarding the judge "
                    "the trophy."
                ),
            },
            {
                "actor": "Diego and Carlos",
                "action": "Diego greets Carlos at the ceremony.",
                "field": "audience_knowledge",
                "claim": "The audience sees Diego murder Carlos.",
                "source_field": "The audience sees Diego greet Carlos.",
            },
            {
                "actor": "Diego y Carlos",
                "action": "Diego abraza a Carlos en la ceremonia.",
                "field": "audience_knowledge",
                "claim": "El público ve a Diego golpear a Carlos.",
                "source_field": "El público ve a Diego abrazar a Carlos.",
            },
            {
                "actor": "Diego and Carlos",
                "action": "Diego greets Carlos at the ceremony.",
                "field": "audience_knowledge",
                "claim": "The audience sees Diego murder Carlos.",
                "source_field": "El público ve a Diego saludar a Carlos.",
            },
            {
                "actor": "Diego",
                "action": "Diego opens the door and closes the window.",
                "field": "action",
                "source_action": (
                    "Diego closes the door and opens the window."
                ),
                "source_field": (
                    "Diego closes the door and opens the window."
                ),
            },
            {
                "actor": "Diego",
                "action": "Diego abre la puerta y cierra la ventana.",
                "field": "action",
                "source_action": (
                    "Diego cierra la puerta y abre la ventana."
                ),
                "source_field": (
                    "Diego cierra la puerta y abre la ventana."
                ),
            },
            {
                "actor": "Diego",
                "action": "Diego enters the arena and exits the house.",
                "field": "action",
                "source_action": (
                    "Diego exits the arena and enters the house."
                ),
                "source_field": (
                    "Diego exits the arena and enters the house."
                ),
            },
            {
                "actor": "Diego",
                "action": "Diego wins the race and loses the match.",
                "field": "action",
                "source_action": (
                    "Diego loses the race and wins the match."
                ),
                "source_field": (
                    "Diego loses the race and wins the match."
                ),
            },
            {
                "actor": "Diego",
                "action": (
                    "Diego opens the door and does not open the window."
                ),
                "field": "action",
                "source_action": (
                    "Diego does not open the door and opens the window."
                ),
                "source_field": (
                    "Diego does not open the door and opens the window."
                ),
            },
            {
                "actor": "Diego",
                "action": "Diego abre la puerta y no abre la ventana.",
                "field": "action",
                "source_action": (
                    "Diego no abre la puerta y abre la ventana."
                ),
                "source_field": (
                    "Diego no abre la puerta y abre la ventana."
                ),
            },
            {
                "actor": "Conductor",
                "action": (
                    "Conductor announces that one peso now equals three "
                    "dollars."
                ),
                "field": "action",
                "source_action": (
                    "Conductor announces that one peso now equals two dollars."
                ),
                "source_field": (
                    "Conductor announces that one peso now equals two dollars."
                ),
            },
            {
                "actor": "Conductor",
                "action": (
                    "Conductor anuncia que un peso ahora equivale a tres "
                    "dólares."
                ),
                "field": "action",
                "source_action": (
                    "Conductor anuncia que un peso ahora equivale a dos "
                    "dólares."
                ),
                "source_field": (
                    "Conductor anuncia que un peso ahora equivale a dos "
                    "dólares."
                ),
            },
            {
                "actor": "Diego",
                "action": "Diego buys 3 cars.",
                "field": "action",
                "source_action": "Diego buys 2 cars.",
                "source_field": "Diego buys 2 cars.",
            },
            {
                "actor": "Richie",
                "action": "Richie says one peso equals three dollars.",
                "field": "action",
                "source_action": (
                    "Richie says one peso equals three or five dollars."
                ),
                "source_field": (
                    "Richie says one peso equals three or five dollars."
                ),
            },
            {
                "actor": "Richie",
                "action": "Richie says one peso equals three dollars.",
                "field": "action",
                "source_action": (
                    "Richie says one peso does not equal three but five "
                    "dollars."
                ),
                "source_field": (
                    "Richie says one peso does not equal three but five "
                    "dollars."
                ),
            },
            {
                "actor": "Diego",
                "action": "Diego wins the first race.",
                "field": "action",
                "source_action": "Diego wins the second race.",
                "source_field": "Diego wins the second race.",
            },
            {
                "actor": "Diego",
                "action": "Diego gana la primera carrera.",
                "field": "action",
                "source_action": "Diego gana la segunda carrera.",
                "source_field": "Diego gana la segunda carrera.",
            },
        )
        for case in cases:
            with self.subTest(field=case["field"], claim=case.get("claim")):
                field = case["field"]
                source_action = case.get("source_action", case["action"])
                source_field = case["source_field"]
                source = f"[PAGE 1]\n{source_action}\n"
                if source_field != source_action:
                    source += f"{source_field}\n"
                beat = {
                    "order": 1,
                    "phase": "climax",
                    "page": 1,
                    "actor": case["actor"],
                    "action": case["action"],
                    "result": "NOT LOCATED",
                    "character_knowledge": "NOT LOCATED",
                    "audience_knowledge": "NOT LOCATED",
                }
                if field != "action":
                    beat[field] = case["claim"]
                required_fields = ["actor", "action"]
                if field not in required_fields:
                    required_fields.append(field)
                row = {
                    "slot": "row_001",
                    "kind": "sequence_evidence",
                    "identifier": "sequence_ledger[0]",
                    "subject": {
                        "beat": beat,
                        "required_fields": required_fields,
                        "claim_sha256": "a" * 64,
                    },
                }
                anchors = cv._source_anchor_catalog(source)

                def token(check_field, fragment):
                    anchor_id = next(
                        key for key, anchor in anchors.items()
                        if fragment.rstrip(".") in anchor["excerpt"]
                    )
                    return f"{row['slot']}:{check_field}:{anchor_id}"

                checks = [
                    {
                        "field": check_field,
                        "source_id": token(
                            check_field,
                            source_field if check_field == field else source_action,
                        ),
                        "supports": True,
                    }
                    for check_field in required_fields
                ]
                decoded, reason = cv._decode_grounded_detail_value(
                    {
                        "classification": "supported",
                        "checks": checks,
                        "note": "The source is claimed to prove every field.",
                    },
                    row,
                    source,
                )

                self.assertIsNone(decoded)
                self.assertTrue(
                    "participant roles" in str(reason)
                    or "claimed participant" in str(reason)
                    or "claim predicate" in str(reason)
                    or "claim polarity" in str(reason)
                    or "atomic fact" in str(reason)
                    or "atomic event" in str(reason)
                    or "actor-action event" in str(reason)
                    or "compound event" in str(reason)
                    or "numeric fact" in str(reason),
                    reason,
                )

    def test_sequence_role_relations_preserve_joint_actor_permutations(self):
        for claim, source in (
            (
                "Diego and Carlos lift the golden trophy together.",
                "Carlos and Diego lift the golden trophy together.",
            ),
            (
                "Diego, Carlos, and Ana lift the golden trophy together.",
                "Ana, Diego, and Carlos lift the golden trophy together.",
            ),
            (
                "Diego y Carlos levantan juntos el trofeo dorado.",
                "Carlos y Diego levantan juntos el trofeo dorado.",
            ),
            (
                "Diego, Carlos y Ana levantan juntos el trofeo dorado.",
                "Ana, Diego y Carlos levantan juntos el trofeo dorado.",
            ),
        ):
            with self.subTest(source=source):
                self.assertFalse(
                    cv._sequence_has_role_relation_swap(claim, source)
                )
        for claim, passive_source in (
            (
                "Carlos awards Diego.",
                "Diego is awarded by Carlos.",
            ),
            (
                "Carlos gives Diego the trophy.",
                "Diego is given the trophy by Carlos.",
            ),
        ):
            with self.subTest(passive_source=passive_source):
                self.assertFalse(
                    cv._sequence_has_role_relation_swap(
                        claim, passive_source
                    )
                )
        self.assertTrue(cv._sequence_negation_matches(
            "Diego does not open the door.",
            "Diego does not move and does not open the door.",
        ))
        self.assertTrue(cv._sequence_negation_matches(
            "Diego opens the door.",
            "Diego without hesitation opens the door.",
        ))
        self.assertTrue(cv._sequence_negation_matches(
            "Diego abre la puerta.",
            "Diego sin dudar abre la puerta.",
        ))
        self.assertTrue(cv._sequence_negation_matches(
            "Diego opens the door.",
            "Diego tries to smile but opens the door.",
        ))
        self.assertTrue(cv._sequence_negation_matches(
            "Diego opens the door.",
            "Diego may stumble yet opens the door.",
        ))
        self.assertTrue(cv._sequence_negation_matches(
            "Diego abre la puerta.",
            "Diego intenta sonreír pero abre la puerta.",
        ))
        self.assertTrue(cv._sequence_numeric_claim_matches(
            "Diego opens the door at once.",
            "Diego immediately opens the door.",
        ))
        self.assertTrue(cv._sequence_numeric_claim_matches(
            "Diego wins once again.",
            "Diego wins again.",
        ))
        self.assertTrue(cv._sequence_numeric_claim_matches(
            "Diego wins the race on p.1.",
            "Diego wins the race.",
        ))
        self.assertTrue(cv._sequence_numeric_claim_matches(
            "Diego gana la carrera en la página 1.",
            "Diego gana la carrera.",
        ))
        self.assertTrue(cv._sequence_atomic_fact_matches(
            "one peso equals three dollars",
            "1 peso equals 3 dollars",
        ))
        self.assertTrue(cv._sequence_atomic_fact_matches(
            "un peso equivale a tres dólares",
            "1 peso equivale a 3 dólares",
        ))
        self.assertFalse(cv._sequence_atomic_fact_matches(
            "one peso equals three dollars",
            "one peso equals two dollars",
        ))
        self.assertTrue(cv._sequence_numeric_claim_matches(
            "Three judges award a trophy to a winner.",
            "Tres jueces entregan un trofeo a un ganador.",
        ))
        self.assertTrue(cv._sequence_numeric_claim_matches(
            "One peso equals three dollars in an arena.",
            "Un peso equivale a tres dólares en una arena.",
        ))
        self.assertFalse(cv._sequence_numeric_claim_matches(
            "Once jueces califican.",
            "Diez jueces califican.",
        ))
        self.assertFalse(cv._sequence_numeric_claim_matches(
            "Hay once jueces.",
            "Hay diez jueces.",
        ))

    def test_sequence_evidence_accepts_translation_and_paraphrase(self):
        source = (
            "[PAGE 1]\nDiego abre la pesada puerta de la bóveda.\n"
            "Diego descubre que Carlos hizo trampa en el concurso.\n"
        )
        row = {
            "slot": "row_001",
            "kind": "sequence_evidence",
            "identifier": "sequence_ledger[0]",
            "subject": {
                "beat": {
                    "order": 1,
                    "phase": "climax",
                    "page": 1,
                    "actor": "Diego",
                    "action": "Diego opens the heavy vault door.",
                    "result": "NOT LOCATED",
                    "character_knowledge": (
                        "Diego learns Carlos cheated in the contest."
                    ),
                    "audience_knowledge": "NOT LOCATED",
                },
                "required_fields": [
                    "actor", "action", "character_knowledge",
                ],
                "claim_sha256": "a" * 64,
            },
        }
        anchors = cv._source_anchor_catalog(source)

        def token(field: str, fragment: str) -> str:
            anchor_id = next(
                key for key, anchor in anchors.items()
                if fragment in anchor["excerpt"]
            )
            return f"{row['slot']}:{field}:{anchor_id}"

        decoded, reason = cv._decode_grounded_detail_value(
            {
                "classification": "supported",
                "checks": [
                    {
                        "field": "actor",
                        "source_id": token("actor", "Diego abre"),
                        "supports": True,
                    },
                    {
                        "field": "action",
                        "source_id": token("action", "Diego abre"),
                        "supports": True,
                    },
                    {
                        "field": "character_knowledge",
                        "source_id": token(
                            "character_knowledge", "Diego descubre"
                        ),
                        "supports": True,
                    },
                ],
                "note": "The Spanish source proves the English frozen fields.",
            },
            row,
            source,
        )

        self.assertIsNotNone(decoded, reason)

        for source_action, frozen_action in (
            ("Diego walks into the stadium.", "Diego enters the arena."),
            ("Diego purchases the automobile.", "Diego buys the car."),
            ("Diego flees from the house.", "Diego escapes the home."),
            ("Diego is killed in the alley.", "Diego dies in the alley."),
            ("Diego takes first place in the race.", "Diego wins the race."),
            (
                "Diego opens the door and closes the window.",
                "Diego opens the door and closes the window.",
            ),
            (
                "Diego announces that 1 peso now equals 3 dollars.",
                "Diego announces that one peso now equals three dollars.",
            ),
        ):
            with self.subTest(frozen_action=frozen_action):
                paraphrase_source = f"[PAGE 1]\n{source_action}\n"
                paraphrase_row = copy.deepcopy(row)
                paraphrase_row["subject"]["beat"].update({
                    "action": frozen_action,
                    "character_knowledge": "NOT LOCATED",
                })
                paraphrase_row["subject"]["required_fields"] = [
                    "actor", "action",
                ]
                anchor_id = next(iter(
                    cv._source_anchor_catalog(paraphrase_source)
                ))
                decoded, reason = cv._decode_grounded_detail_value(
                    {
                        "classification": "supported",
                        "checks": [
                            {
                                "field": field,
                                "source_id": (
                                    f"{paraphrase_row['slot']}:{field}:"
                                    f"{anchor_id}"
                                ),
                                "supports": True,
                            }
                            for field in ("actor", "action")
                        ],
                        "note": "The source action is a valid paraphrase.",
                    },
                    paraphrase_row,
                    paraphrase_source,
                )

                self.assertIsNotNone(decoded, reason)

    def test_sequence_audience_event_accepts_bilingual_grounding(self):
        source = (
            "[PAGE 1]\nDiego enters the arena.\n"
            "El público ve a Diego ingresar al estadio.\n"
        )
        row = {
            "slot": "row_001",
            "kind": "sequence_evidence",
            "identifier": "sequence_ledger[0]",
            "subject": {
                "beat": {
                    "order": 1,
                    "phase": "climax",
                    "page": 1,
                    "actor": "Diego",
                    "action": "Diego enters the arena.",
                    "result": "NOT LOCATED",
                    "character_knowledge": "NOT LOCATED",
                    "audience_knowledge": (
                        "The audience watches Diego enter the arena."
                    ),
                },
                "required_fields": [
                    "actor", "action", "audience_knowledge",
                ],
                "claim_sha256": "a" * 64,
            },
        }
        anchors = cv._source_anchor_catalog(source)

        def token(field, fragment):
            source_id = next(
                key for key, anchor in anchors.items()
                if fragment in anchor["excerpt"]
            )
            return f"{row['slot']}:{field}:{source_id}"

        decoded, reason = cv._decode_grounded_detail_value(
            {
                "classification": "supported",
                "checks": [
                    {
                        "field": field,
                        "source_id": token(
                            field,
                            "El público" if field == "audience_knowledge"
                            else "Diego enters",
                        ),
                        "supports": True,
                    }
                    for field in (
                        "actor", "action", "audience_knowledge",
                    )
                ],
                "note": "The bilingual source proves the audience event.",
            },
            row,
            source,
        )

        self.assertIsNotNone(decoded, reason)

    def test_subjective_earned_resolution_count_stays_taste(self):
        coverage = valid_coverage()
        coverage["concerns"][0]["point"] = (
            "The ending should preserve the two or three genuinely earned "
            "resolutions before the parody escalates."
        )

        checks = cv.build_existing_evidence_checks(
            coverage, SCREENPLAY_TEXT
        )

        self.assertFalse(any(
            row["source_field_path"] == "concerns[0].point"
            and row["trigger"] == "counting_claim"
            for row in checks
        ))

    def test_subjective_count_filter_only_inspects_counted_phrase(self):
        coverage = valid_coverage()
        cases = (
            ("Juanito earned three kills.", True),
            ("Three meaningful deaths end the story.", False),
            ("The strongest three jokes land late.", False),
            ("The best two laughs are in the climax.", False),
            ("Tony bribes two or three judges.", True),
        )

        for claim, expected in cases:
            coverage["concerns"][0]["point"] = claim
            checks = cv.build_existing_evidence_checks(
                coverage, SCREENPLAY_TEXT
            )
            found = any(
                row["source_field_path"] == "concerns[0].point"
                and row["trigger"] == "counting_claim"
                for row in checks
            )
            self.assertEqual(found, expected, claim)

    def test_repeated_count_anchors_keep_occurrence_subjectivity(self):
        cases = (
            (
                "Three jokes land, while the strongest three jokes remain.",
                [False, True],
            ),
            (
                "The strongest three jokes land, while three jokes remain.",
                [True, False],
            ),
        )

        for claim, expected in cases:
            details = cv._material_count_claims_details(
                claim, annotate_subjectivity=True
            )
            self.assertEqual(
                [row["_subjective_count"] for row in details],
                expected,
                claim,
            )

    def test_count_transport_derives_zero_instance_note(self):
        row = {
            "slot": "row_001",
            "kind": "existing_evidence",
            "identifier": "story_spine.turning_points[0]",
            "subject": {
                "trigger": "counting_claim",
                "claim": "One member arrives.",
                "claimed_total": 1,
                "count_quantifier": "exact",
            },
        }
        expanded = cv._expand_detail_audit_payload(
            {"count_results": [{"slot": row["slot"], "instances": []}]},
            [row],
        )

        evidence, _citations = cv.decode_detail_audit_payload(
            expanded, [row], SCREENPLAY_TEXT
        )

        self.assertEqual(evidence[0]["classification"], "unsupported")
        self.assertEqual(
            evidence[0]["note"],
            "Engine-verified count: 0 matching of 0 observed instances "
            "against the exact claimed count of 1; classification: "
            "unsupported.",
        )

    def test_legacy_count_note_is_replaced_by_verified_totals(self):
        source = "[PAGE 1]\nLlega Lucesita"
        subject = {
            "trigger": "counting_claim",
            "claim": "One member arrives.",
            "claimed_total": 1,
            "claimed_universe_total": 1,
            "count_quantifier": "exact",
        }
        candidate = {
            "classification": "supported",
            "observed_total": 1,
            "observed_universe_total": 1,
            "instances": [{
                "label": "p.1: Llega Lucesita",
                "page": 1,
                "excerpt": "Llega Lucesita",
                "matches_claim": True,
                "multiplicity": 1,
            }],
            "note": "Seven matching instances were found.",
        }

        decoded = cv._decode_count_audit_result(candidate, subject, source)

        self.assertTrue(decoded["count_ledger"]["valid"])
        self.assertIn("1 matching of 1 observed", decoded["note"])
        self.assertNotIn("Seven", decoded["note"])

    def test_derived_supported_count_rejects_a_contradictory_note(self):
        source = "[PAGE 1]\nLlega Lucesita"
        subject = {
            "trigger": "counting_claim",
            "claim": "One member arrives.",
            "claimed_total": 1,
            "claimed_universe_total": 1,
            "count_quantifier": "exact",
        }
        candidate = {
            "classification": "supported",
            "observed_total": 1,
            "observed_universe_total": 1,
            "instances": [{
                "label": "p.1: Llega Lucesita",
                "page": 1,
                "excerpt": "Llega Lucesita",
                "matches_claim": True,
                "multiplicity": 1,
            }],
            "note": "This evidence fails to support the claimed count.",
        }

        decoded = cv._decode_count_audit_result(candidate, subject, source)

        self.assertFalse(decoded["count_ledger"]["valid"])
        self.assertIn(
            "contradicts its own note", decoded["count_ledger"]["reason"]
        )

    def test_cosquillitas_49_detail_rows_fit_one_strict_call(self):
        rows = [
            {
                "slot": f"row_{index:03d}",
                "kind": "existing_evidence",
                "identifier": f"field[{index}]",
                "subject": {
                    "field_path": f"field[{index}]",
                    "trigger": "absolute_negative",
                },
            }
            for index in range(1, 50)
        ]
        overflow = cv._detail_overflow_slots(rows)
        tool = cv.build_detail_audit_tool(rows)
        result_schema = tool["input_schema"]["properties"]["text_results"]
        values = {
            row["slot"]: "supported: checked" for row in rows
        }
        packed = {
            "results": {
                **{
                    slot: value for slot, value in values.items()
                    if slot not in overflow
                },
                "overflow_json": json.dumps({
                    slot: values[slot] for slot in overflow
                }),
            }
        }

        expanded = cv._expand_detail_audit_payload(packed, rows)

        self.assertEqual(len(overflow), 7)
        self.assertEqual(result_schema["minItems"], 49)
        self.assertEqual(result_schema["maxItems"], 49)
        self.assertEqual(
            result_schema["items"]["properties"]["slot"]["enum"],
            [row["slot"] for row in rows],
        )
        self.assertEqual(expanded["results"], values)
        self.assertLessEqual(
            cv.strict_schema_complexity(tool["input_schema"])[
                "property_count"
            ],
            cv.STRICT_BUDGET["property_count"],
        )

    def test_cosquillitas_shape_fits_six_typed_arrays(self):
        rows = []

        def add(count, kind, subject):
            for _index in range(count):
                rows.append({
                    "slot": f"row_{len(rows) + 1:03d}",
                    "kind": kind,
                    "identifier": f"field[{len(rows)}]",
                    "subject": copy.deepcopy(subject),
                })

        add(19, "existing_evidence", {"trigger": "absolute_negative"})
        add(2, "existing_evidence", {
            "focused_evidence": [{"role": "source_device", "page": 1}],
        })
        add(4, "existing_evidence", {"trigger": "counting_claim"})
        add(10, "citation_relevance", {})
        add(15, "sequence_evidence", {
            "required_fields": [
                "actor", "action", "result", "audience_knowledge",
            ],
        })
        add(5, "sequence_evidence", {
            "required_fields": list(cv.GROUNDED_SEQUENCE_FIELDS),
        })

        schema = cv.build_detail_audit_tool(rows)["input_schema"]
        stats = cv.strict_schema_complexity(schema)

        self.assertEqual(schema["required"], [
            "text_results", "focused_results", "count_results",
            "citation_results", "sequence_results",
            "sequence_knowledge_results",
        ])
        self.assertEqual(stats, {
            "object_count": 8,
            "property_count": 40,
            "optional_parameter_count": 0,
            "union_parameter_count": 0,
            "maximum_depth": 5,
        })

    def test_typed_detail_arrays_reject_duplicate_or_missing_slots(self):
        rows = [
            {
                "slot": "row_001",
                "kind": "existing_evidence",
                "identifier": "field[0]",
                "subject": {"trigger": "absolute_negative"},
            },
            {
                "slot": "row_002",
                "kind": "existing_evidence",
                "identifier": "field[1]",
                "subject": {"trigger": "absolute_negative"},
            },
        ]
        duplicate = {
            "text_results": [
                {
                    "slot": "row_001",
                    "classification": "supported",
                    "note": "Checked once.",
                },
                {
                    "slot": "row_001",
                    "classification": "supported",
                    "note": "Checked twice.",
                },
            ],
        }

        expanded = cv._expand_detail_audit_payload(duplicate, rows)

        self.assertEqual(expanded, {
            "results": {"row_001": None, "row_002": None},
        })
        self.assertEqual(
            [row["slot"] for row in cv._malformed_text_detail_rows(
                expanded, rows, SCREENPLAY_TEXT
            )],
            ["row_001", "row_002"],
        )

        unexpected = {
            "text_results": [
                {
                    "slot": slot,
                    "classification": "supported",
                    "note": "Checked.",
                }
                for slot in ("row_001", "row_002", "row_999")
            ],
        }
        self.assertEqual(
            cv._expand_detail_audit_payload(unexpected, rows),
            {"results": {
                "row_001": {
                    "classification": "supported", "note": "Checked."
                },
                "row_002": {
                    "classification": "supported", "note": "Checked."
                },
            }},
        )

    def test_typed_detail_arrays_preserve_other_group_when_one_is_missing(self):
        text_row = {
            "slot": "row_001",
            "kind": "existing_evidence",
            "identifier": "story_spine.ending",
            "subject": {"trigger": "absolute_negative"},
        }
        citation_row = {
            "slot": "row_002",
            "kind": "citation_relevance",
            "identifier": "concerns[0]",
            "subject": {
                "page": 1,
                "excerpt": "Diego is waiting outside",
                "claim_span": "Diego is waiting outside.",
                "claim_sha256": "a" * 64,
            },
        }
        expanded = cv._expand_detail_audit_payload(
            {
                "text_results": [{
                    "slot": "row_001",
                    "classification": "supported",
                    "note": "The ending was checked.",
                }],
                "unused_results": [{"slot": "row_999"}],
            },
            [text_row, citation_row],
        )

        self.assertEqual(
            expanded["results"]["row_001"]["note"],
            "The ending was checked.",
        )
        self.assertIsNone(expanded["results"]["row_002"])

    def test_typed_detail_arrays_preserve_unique_siblings_when_one_is_missing(self):
        rows = [
            {
                "slot": f"row_{index:03d}",
                "kind": "existing_evidence",
                "identifier": f"field[{index}]",
                "subject": {"trigger": "absolute_negative"},
            }
            for index in range(1, 4)
        ]
        partial = {
            "text_results": [
                {
                    "slot": "row_001",
                    "classification": "supported",
                    "note": "First row checked.",
                },
                {
                    "slot": "row_003",
                    "classification": "supported",
                    "note": "Third row checked.",
                },
            ],
        }

        expanded = cv._expand_detail_audit_payload(partial, rows)

        self.assertEqual(
            expanded["results"]["row_001"],
            {"classification": "supported", "note": "First row checked."},
        )
        self.assertIsNone(expanded["results"]["row_002"])
        self.assertEqual(
            expanded["results"]["row_003"],
            {"classification": "supported", "note": "Third row checked."},
        )
        self.assertEqual(
            [row["slot"] for row in cv._malformed_text_detail_rows(
                expanded, rows, SCREENPLAY_TEXT
            )],
            ["row_002"],
        )

    def test_text_detail_decoder_reports_exact_field_failure(self):
        cases = [
            (
                {"classification": "supported"},
                "exactly classification and note",
            ),
            (
                {"classification": "maybe", "note": "Checked."},
                "classification is invalid",
            ),
            (
                {"classification": "supported", "note": 7},
                "note must be a string",
            ),
            (
                {"classification": "supported", "note": "  "},
                "note must be non-empty",
            ),
        ]
        for candidate, expected in cases:
            with self.subTest(candidate=candidate):
                decoded, reason = cv._decode_text_detail_value_with_reason(
                    candidate
                )
                self.assertIsNone(decoded)
                self.assertIn(expected, str(reason))

    def test_large_detail_repair_finishes_within_seven_calls_and_fails_closed(self):
        source = SCREENPLAY_TEXT.replace(
            "Diego encuentra a los NIÑOS",
            "A camera records the team for a later video reveal.\n"
            "Diego encuentra a los NIÑOS",
        ).replace(
            "La final. Lucía",
            "The video appears and reveals what the camera recorded.\n"
            "La final. Lucía",
        )
        coverage = valid_coverage()
        coverage["development_priorities"][0] = {
            "priority": "Plant the missing video source.",
            "why": "No camera or recording source is established anywhere.",
            "how": "Add a camera before the reveal.",
        }
        suffix = " This remains unresolved."
        coverage["logline"] += suffix
        for field in (
            "protagonist", "want", "need", "opposition", "stakes",
            "climax", "ending",
        ):
            coverage["story_spine"][field] += suffix
        for turn in coverage["story_spine"]["major_turns"]:
            turn["turn"] += suffix
        coverage["synopsis"] += suffix
        for item in coverage["lens_notes"]:
            item["analysis"] += suffix
        for collection in ("strengths", "concerns"):
            for item in coverage[collection]:
                item["point"] += suffix
        coverage["champion_reason"] += suffix
        coverage["pass_reason"] += suffix
        coverage["uncertainties"] = [
            f"The {subject} remains unresolved."
            for subject in ("source", "action", "result", "motive", "timing")
        ]
        coverage["continuity_flags"] = [
            f"The {subject} remains unresolved."
            for subject in (
                "opening", "setup", "turn", "climax", "ending", "tag",
            )
        ]
        coverage["genre_contract"]["failures"] = [
            f"The {subject} remains unresolved."
            for subject in ("tone", "genre", "promise", "pattern", "payoff")
        ]
        evidence_checks = cv.build_existing_evidence_checks(
            coverage, source
        )
        audit = provider_audit_core(coverage)
        next(
            verdict for verdict in audit["verdicts"]
            if verdict["claim_id"] == "spine.protagonist"
        )["classification"] = "partially_supported"
        normalized_audit = cv.normalize_audit_tool_input(
            copy.deepcopy(audit), range(1, 7)
        )
        rows = cv.build_detail_audit_rows(
            coverage,
            evidence_checks,
            normalized_audit["sequence_ledger"],
        )
        focused_row = next(
            row for row in rows
            if row["subject"].get("focused_evidence")
        )
        focused_value = {
            "classification": "supported",
            "note": "The source and its activation are established.",
            "reviewed_roles": cv._focused_role_tokens(
                focused_row["subject"]
            ),
            "source_status": "established",
            "activation_status": "established",
        }
        malformed_detail = detail_payload_for_rows(rows, source)
        complete_detail = copy.deepcopy(malformed_detail)
        complete_detail["results"][focused_row["slot"]] = json.dumps(
            focused_value
        )
        prior_evidence, prior_citations = cv.decode_detail_audit_payload(
            complete_detail, rows, source
        )
        prior_audit = cv._replace_audit_details(
            normalized_audit, prior_evidence, prior_citations
        )
        corrected = copy.deepcopy(coverage)
        corrected["story_spine"]["protagonist"] = (
            "Diego Salas, retired goalkeeper"
        )
        corrected["development_priorities"][0] = {
            "priority": "Clarify the climax causality.",
            "why": "The reversal should follow a visible character choice.",
            "how": "Connect the existing setup to that choice.",
        }
        pending_detail = pending_reaudit_detail_payload(
            coverage,
            prior_audit,
            corrected,
            normalized_audit["sequence_ledger"],
            source,
        )
        transport = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (malformed_detail, settled_usage()),
            ({"results": {focused_row["slot"]: focused_value}}, settled_usage()),
            (corrected, settled_usage()),
            (provider_audit_core(corrected), settled_usage()),
            (pending_detail, settled_usage()),
        ])

        report, _usage = run_engine(
            new_store(),
            transport,
            text=source,
            max_cost_usd=5.0,
            max_calls=7,
        )

        self.assertEqual(len(rows), 59)
        self.assertEqual(report["status"], "needs_review")
        self.assertIn(
            "guard.sequence_integrity",
            report["fact_audit"]["central_failures"],
        )
        self.assertEqual(report["cost"]["call_count"], 4)
        self.assertEqual(len(transport.calls), 4)

    def test_sequence_retry_is_bounded_and_details_stay_on_audit_model(self):
        coverage = valid_coverage()
        bad_core = provider_audit_core(coverage)
        ground_final_scene_for_test(bad_core)
        climax = bad_core["sequence_ledger"]["climax"][0]
        climax["actor"] = "Two members"
        climax["action"] = coverage["story_spine"]["climax"]
        bad_core["sequence_ledger"]["final_scene"][0][
            "character_knowledge"
        ] = "Both members know the result."
        good_core = copy.deepcopy(bad_core)
        good_core["sequence_ledger"]["climax"][0]["actor"] = "Diego"
        good_core["sequence_ledger"]["final_scene"][0][
            "character_knowledge"
        ] = "Diego knows the result."
        normalized_good = cv.normalize_audit_tool_input(
            copy.deepcopy(good_core), range(1, 7)
        )
        repair = {
            "repairs": {
                "row_000_actor": "Diego",
                "row_002_character_knowledge": "Diego knows the result.",
            },
        }
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (bad_core, settled_usage()),
                (repair, settled_usage()),
                (
                    supported_detail_payload(coverage, normalized_good),
                    settled_usage(),
                ),
            ]
        )

        report, _usage = run_engine(
            new_store(), transport, max_cost_usd=5.0
        )

        self.assertEqual(report["status"], "sealed")
        self.assertEqual(
            transport.calls[2]["stage"],
            "coverage_v1.fact_audit_sequence_repair",
        )
        self.assertEqual(transport.calls[2]["model_key"], "sonnet")
        self.assertEqual(
            transport.calls[2]["tool"]["name"],
            "submit_sequence_field_repairs_v1_2",
        )
        repair_schema = transport.calls[2]["tool"]["input_schema"][
            "properties"
        ]["repairs"]
        self.assertEqual(
            set(repair_schema["properties"]),
            set(repair_schema["required"]),
        )
        self.assertEqual(
            set(repair_schema["properties"]),
            {"row_000_actor", "row_002_character_knowledge"},
        )
        self.assertNotIn(
            "sequence_ledger",
            transport.calls[2]["tool"]["input_schema"]["properties"],
        )
        retry_text = "\n".join(
            str(block.get("text", ""))
            for block in transport.calls[2]["user_blocks"]
        )
        self.assertIn("# TARGETED SEQUENCE REPAIR", retry_text)
        self.assertNotIn("# SCREENPLAY TEXT", retry_text)
        self.assertEqual(transport.calls[3]["model_key"], "haiku")
        self.assertEqual(report["models"]["audit_effective"], "haiku")
        self.assertEqual(report["models"]["audit_core_repair"], "sonnet")
        self.assertEqual(
            report["fact_audit"]["verdicts"][0]["classification"],
            "supported",
        )

    def test_targeted_sequence_retry_requires_every_field_slot(self):
        coverage = valid_coverage()
        bad_core = provider_audit_core(coverage)
        decisive = bad_core["sequence_ledger"]["climax"][0]
        earlier = copy.deepcopy(decisive)
        earlier["page"] = 5
        earlier["actor"] = "Two judges"
        earlier["action"] = "Diego confronts Román before the final."
        bad_core["sequence_ledger"]["climax"] = [earlier, decisive]
        transport = FakeTransport([
            (coverage, settled_usage()),
            (bad_core, settled_usage()),
            ({"repairs": {}}, settled_usage()),
        ])

        with self.assertRaisesRegex(
            cv.CoverageContractError, "did not return every required field"
        ):
            run_engine(new_store(), transport, max_cost_usd=5.0)

        self.assertEqual(len(transport.calls), 3)

    def test_rejected_sequence_field_gets_one_bounded_micro_retry(self):
        coverage = valid_coverage()
        bad_core = provider_audit_core(coverage)
        ground_final_scene_for_test(bad_core)
        bad_core["sequence_ledger"]["climax"][0]["actor"] = "Two members"
        bad_core["sequence_ledger"]["final_scene"][0][
            "character_knowledge"
        ] = "Both members know the result."
        repaired_core = copy.deepcopy(bad_core)
        repaired_core["sequence_ledger"]["climax"][0]["actor"] = "Diego"
        repaired_core["sequence_ledger"]["final_scene"][0][
            "character_knowledge"
        ] = "Diego knows that the result is final."
        normalized_repaired = cv.normalize_audit_tool_input(
            repaired_core, range(1, 7)
        )
        first_repair = {
            "repairs": {
                "row_000_actor": "Diego",
                "row_002_character_knowledge": (
                    "Diego celebrates the result."
                ),
            },
        }
        micro_repair = {
            "repairs": {
                "row_002_character_knowledge": (
                    "Diego knows that the result is final."
                ),
            },
        }
        transport = FakeTransport([
            (coverage, settled_usage()),
            (bad_core, settled_usage()),
            (first_repair, settled_usage()),
            (micro_repair, settled_usage()),
            (
                supported_detail_payload(coverage, normalized_repaired),
                settled_usage(),
            ),
        ])

        report, _usage = run_engine(
            new_store(), transport, max_cost_usd=5.0
        )

        self.assertEqual(report["status"], "sealed")
        self.assertEqual(
            [call["stage"] for call in transport.calls],
            [
                "coverage_v1.coverage",
                "coverage_v1.fact_audit",
                "coverage_v1.fact_audit_sequence_repair",
                "coverage_v1.fact_audit_rejected_sequence_field_repair",
                "coverage_v1.fact_audit_details",
            ],
        )
        micro_call = transport.calls[3]
        self.assertEqual(micro_call["model_key"], "sonnet")
        self.assertEqual(
            micro_call["tool"]["name"],
            "submit_rejected_sequence_field_repairs_v1_2",
        )
        micro_schema = micro_call["tool"]["input_schema"]["properties"][
            "repairs"
        ]
        self.assertEqual(
            set(micro_schema["properties"]),
            {"row_002_character_knowledge"},
        )
        self.assertEqual(
            set(micro_schema["properties"]), set(micro_schema["required"])
        )
        self.assertNotIn(
            "sequence_ledger",
            micro_call["tool"]["input_schema"]["properties"],
        )
        micro_text = "\n".join(
            str(block.get("text", ""))
            for block in micro_call["user_blocks"]
        )
        self.assertIn('"required_knower": "Diego"', micro_text)
        self.assertIn("Diego celebrates the result.", micro_text)
        self.assertNotIn("# SCREENPLAY TEXT", micro_text)
        self.assertEqual(
            report["fact_audit"]["sequence_ledger"][0]["actor"], "Diego"
        )
        self.assertEqual(report["cost"]["repair_calls_used"], 2)

    def test_rejected_sequence_micro_retry_freezes_numbered_roster(self):
        candidate = {
            "sequence_ledger": [{
                "order": 1,
                "phase": "climax",
                "actor": "Three judges",
                "action": (
                    "Judge 1, Judge 2, Judge 3, and Judge 4 post scores."
                ),
                "result": "The scores decide the contest.",
                "character_knowledge": (
                    "Judges execute the scheme; runners learn the result."
                ),
                "audience_knowledge": "The audience sees every score.",
                "page": 94,
            }],
        }
        problems = [
            "sequence_ledger[0].actor uses unverified numeric shorthand; "
            "name the actors or roles",
            "sequence_ledger[0].character_knowledge has invalid knowledge "
            "structure; use one knower roster and exactly one knowledge "
            "predicate",
        ]
        rejected = {"repairs": {
            "row_000_actor": "Primer Juez, Segundo Juez, and Tercer Juez",
            "row_000_character_knowledge": "The judges execute the scheme.",
        }}
        partial, invalid = cv._apply_sequence_field_repairs(
            candidate,
            rejected,
            problems,
            defer_invalid_fields=True,
        )
        slots = cv._sequence_field_repair_slots(problems)
        required_actors = cv._required_sequence_actor_repairs(
            partial, invalid, slots
        )
        required_subjects = cv._required_sequence_knower_subjects(
            partial,
            rejected["repairs"],
            invalid,
            slots,
            required_actors,
        )
        valid = {"repairs": {
            "row_000_actor": "The judges",
            "row_000_character_knowledge": "NOT LOCATED",
        }}

        merged = cv._merge_rejected_sequence_field_repairs(
            partial,
            valid,
            invalid,
            required_subjects,
            required_actors,
            slots,
        )

        self.assertEqual(
            merged["sequence_ledger"][0]["actor"],
            "The judges",
        )
        self.assertEqual(
            merged["sequence_ledger"][0]["character_knowledge"],
            "NOT LOCATED",
        )
        self.assertEqual(required_actors, {"row_000_actor": "The judges"})
        self.assertEqual(
            required_subjects,
            {"row_000_character_knowledge": "NOT LOCATED"},
        )
        count_subject = cv._sequence_numbered_role_count_subject(
            merged["sequence_ledger"][0], 95
        )
        self.assertIsNotNone(count_subject)
        self.assertEqual(count_subject["claimed_total"], 4)
        for replacement in (
            "Judge 1, Judge 2, and Judge 3",
            "Judge 1, Judge 2, Judge 3, Judge 4, and Judge 5",
            "Carlo 1, Judge 2, Judge 3, and Judge 4",
        ):
            with self.subTest(replacement=replacement):
                malformed = copy.deepcopy(valid)
                malformed["repairs"]["row_000_actor"] = replacement
                with self.assertRaisesRegex(
                    cv.CoverageContractError, "changed its frozen roster"
                ):
                    cv._merge_rejected_sequence_field_repairs(
                        partial,
                        malformed,
                        invalid,
                        required_subjects,
                        required_actors,
                        slots,
                    )
        for replacement in (
            "The judges know that the scores decide the contest.",
            "Judge 1 knows that the scores decide the contest.",
        ):
            with self.subTest(knowledge=replacement):
                malformed = copy.deepcopy(valid)
                malformed["repairs"][
                    "row_000_character_knowledge"
                ] = replacement
                with self.assertRaisesRegex(
                    cv.CoverageContractError, "invented an ungrounded knower"
                ):
                    cv._merge_rejected_sequence_field_repairs(
                        partial,
                        malformed,
                        invalid,
                        required_subjects,
                        required_actors,
                        slots,
                    )
        for malformed in (
            {"repairs": {"row_000_actor": valid["repairs"]["row_000_actor"]}},
            {"repairs": {**valid["repairs"], "unexpected": "value"}},
            {"repairs": {**valid["repairs"], "row_000_actor": ""}},
            {"repairs": {**valid["repairs"], "row_000_actor": 7}},
        ):
            with self.subTest(malformed=malformed):
                with self.assertRaises(cv.CoverageContractError):
                    cv._merge_rejected_sequence_field_repairs(
                        partial,
                        malformed,
                        invalid,
                        required_subjects,
                        required_actors,
                        slots,
                    )

    def test_rejected_sequence_micro_retry_fails_closed_once(self):
        coverage = valid_coverage()
        bad_core = provider_audit_core(coverage)
        ground_final_scene_for_test(bad_core)
        bad_core["sequence_ledger"]["final_scene"][0][
            "character_knowledge"
        ] = "Both members know the result."
        first_repair = {"repairs": {
            "row_002_character_knowledge": "Diego celebrates the result."
        }}
        malformed_micro = {"repairs": {
            "row_002_character_knowledge": (
                "Diego knows that the result is final, and runners know it."
            )
        }}
        transport = FakeTransport([
            (coverage, settled_usage()),
            (bad_core, settled_usage()),
            (first_repair, settled_usage()),
            (malformed_micro, settled_usage()),
        ])

        with self.assertRaisesRegex(
            cv.CoverageContractError, "one checked clause"
        ):
            run_engine(new_store(), transport, max_cost_usd=5.0)

        self.assertEqual(len(transport.calls), 4)

    def test_rejected_knowledge_cannot_trust_its_original_knower(self):
        candidate = {
            "sequence_ledger": [{
                "order": 1,
                "phase": "climax",
                "actor": "Diego",
                "action": "Diego announces the result.",
                "result": "The contest ends.",
                "character_knowledge": (
                    "Carlos and two runners know the result."
                ),
                "audience_knowledge": "The audience sees the result.",
                "page": 94,
            }],
        }
        problems = [
            "sequence_ledger[0].character_knowledge uses unverified "
            "numeric shorthand; name the actors or roles"
        ]
        repaired = {"repairs": {
            "row_000_character_knowledge": "Carlos knows the result."
        }}

        partial, invalid = cv._apply_sequence_field_repairs(
            candidate,
            repaired,
            problems,
            defer_invalid_fields=True,
        )
        slots = cv._sequence_field_repair_slots(problems)
        required = cv._required_sequence_knower_subjects(
            partial,
            repaired["repairs"],
            invalid,
            slots,
            {},
        )

        self.assertEqual(
            invalid.keys(), {"row_000_character_knowledge"}
        )
        self.assertEqual(
            partial["sequence_ledger"][0]["character_knowledge"],
            candidate["sequence_ledger"][0]["character_knowledge"],
        )
        self.assertEqual(
            required, {"row_000_character_knowledge": "NOT LOCATED"}
        )
        with self.assertRaisesRegex(
            cv.CoverageContractError,
            "not named in the preserved action context",
        ):
            cv._merge_sequence_field_repairs(
                candidate, repaired, problems
            )

    def test_knowledge_repair_uses_action_knower_not_full_actor_roster(self):
        candidate = {
            "sequence_ledger": [{
                "order": 1,
                "phase": "climax",
                "actor": "Diego and Carlos",
                "action": "Only Diego sees the result.",
                "result": "The contest ends.",
                "character_knowledge": "Diego celebrates the result.",
                "audience_knowledge": "The audience sees the result.",
                "page": 94,
            }],
        }
        problems = [
            "sequence_ledger[0].character_knowledge has invalid knowledge "
            "structure; use one knower roster and exactly one knowledge "
            "predicate"
        ]
        first_repair = {"repairs": {
            "row_000_character_knowledge": "Diego celebrates the result."
        }}
        partial, invalid = cv._apply_sequence_field_repairs(
            candidate,
            first_repair,
            problems,
            defer_invalid_fields=True,
        )
        slots = cv._sequence_field_repair_slots(problems)
        required = cv._required_sequence_knower_subjects(
            partial,
            first_repair["repairs"],
            invalid,
            slots,
            {},
        )

        self.assertEqual(required, {
            "row_000_character_knowledge": "Diego"
        })
        with self.assertRaisesRegex(
            cv.CoverageContractError, "changed its frozen knower roster"
        ):
            cv._merge_rejected_sequence_field_repairs(
                partial,
                {"repairs": {
                    "row_000_character_knowledge": (
                        "Diego and Carlos know that the result is final."
                    )
                }},
                invalid,
                required,
                {},
                slots,
            )
        merged = cv._merge_rejected_sequence_field_repairs(
            partial,
            {"repairs": {
                "row_000_character_knowledge": (
                    "Diego knows that the result is final."
                )
            }},
            invalid,
            required,
            {},
            slots,
        )
        self.assertEqual(
            merged["sequence_ledger"][0]["character_knowledge"],
            "Diego knows that the result is final.",
        )

    def test_targeted_sequence_retry_cannot_substitute_the_wrong_actor(self):
        coverage = valid_coverage()
        bad_core = provider_audit_core(coverage)
        bad_core["sequence_ledger"]["climax"][0]["actor"] = "Two members"
        wrong_actor_retry = {
            "repairs": {"row_000_actor": "Román (seen on p.4)"},
        }
        transport = FakeTransport([
            (coverage, settled_usage()),
            (bad_core, settled_usage()),
            (wrong_actor_retry, settled_usage()),
        ])

        with self.assertRaisesRegex(
            cv.CoverageContractError,
            "actor is not named in the preserved action context",
        ):
            run_engine(new_store(), transport, max_cost_usd=5.0)

        self.assertEqual(len(transport.calls), 3)

    def test_targeted_sequence_retry_accepts_the_existing_group_role(self):
        candidate = {
            "sequence_ledger": [{
                "order": 1,
                "phase": "climax",
                "actor": "Three judges",
                "action": "Judge 1, Judge 2, and Judge 3 post their scores.",
                "result": "The scores decide the contest.",
                "character_knowledge": "Tony knows the scores were rigged.",
                "audience_knowledge": "The audience sees every score.",
                "page": 94,
            }],
        }
        problems = [
            "sequence_ledger[0].actor uses unverified numeric shorthand; "
            "name the actors or roles"
        ]
        repaired = {"repairs": {"row_000_actor": "The judges"}}

        merged = cv._merge_sequence_field_repairs(
            candidate, repaired, problems,
        )

        self.assertEqual(merged["sequence_ledger"][0]["actor"], "The judges")

        repaired["repairs"]["row_000_actor"] = "The judges with runners"
        with self.assertRaisesRegex(
            cv.CoverageContractError,
            "actor is not named in the preserved action context",
        ):
            cv._merge_sequence_field_repairs(
                candidate, repaired, problems,
            )

        repaired["repairs"]["row_000_actor"] = "DJ"
        with self.assertRaisesRegex(
            cv.CoverageContractError,
            "actor is not named in the preserved action context",
        ):
            cv._merge_sequence_field_repairs(
                candidate, repaired, problems,
            )

        repaired["repairs"]["row_000_actor"] = "N/A"
        with self.assertRaisesRegex(
            cv.CoverageContractError,
            "actor is not named in the preserved action context",
        ):
            cv._merge_sequence_field_repairs(
                candidate, repaired, problems,
            )

    def test_targeted_sequence_retry_does_not_singularize_a_proper_name(self):
        candidate = {
            "sequence_ledger": [{
                "order": 1,
                "phase": "climax",
                "actor": "Two judges",
                "action": "Carlos scores the decisive goal.",
                "result": "The goal decides the contest.",
                "character_knowledge": "Carlos knows the result.",
                "audience_knowledge": "The audience sees the goal.",
                "page": 94,
            }],
        }
        repaired = {"repairs": {"row_000_actor": "Carlo"}}

        with self.assertRaisesRegex(
            cv.CoverageContractError,
            "actor is not named in the preserved action context",
        ):
            cv._merge_sequence_field_repairs(
                candidate,
                repaired,
                [
                    "sequence_ledger[0].actor uses unverified numeric shorthand; "
                    "name the actors or roles"
                ],
            )

    def test_targeted_sequence_retry_rejects_a_hidden_second_knower(self):
        candidate = {
            "sequence_ledger": [{
                "order": 1,
                "phase": "climax",
                "actor": "Carlos",
                "action": "Carlos announces the result.",
                "result": "The contest ends.",
                "character_knowledge": "Two people know the result.",
                "audience_knowledge": "The audience sees the result.",
                "page": 94,
            }],
        }
        for claim in (
            "Carlos",
            "Carlos knows the result, and runners know it too.",
            "Carlos knows the result; runners are aware too.",
            "Carlos knows the result while runners find out too.",
            "Carlos knows the result. Runners become aware too.",
            "Carlos knows the result: runners are aware too.",
            "Carlos knows the result, although runners are aware too.",
            "Carlos knows the result — runners are aware too.",
            "Carlos knows the result\nrunners are aware too.",
            "Carlos knows the result (runners are aware too).",
            "Carlos knows the result [runners are aware too].",
            "Carlos knows the result / runners are aware too.",
            (
                "Carlos knows the result although the extremely patient "
                "championship runners are aware too."
            ),
        ):
            with self.subTest(claim=claim):
                repaired = {
                    "repairs": {
                        "row_000_character_knowledge": claim,
                    },
                }
                with self.assertRaisesRegex(
                    cv.CoverageContractError, "exactly one checked clause"
                ):
                    cv._merge_sequence_field_repairs(
                        candidate,
                        repaired,
                        [
                            "sequence_ledger[0].character_knowledge uses "
                            "unverified numeric shorthand; name the actors "
                            "or roles"
                        ],
                    )

    def test_corrected_cosquillitas_phase_buckets_reach_detail_audit(self):
        # Billy's approved audit: Richie chooses Lucesita before the exposé,
        # so both beats remain in the multi-stage climax before ending begins.
        coverage = valid_coverage()
        audit = provider_audit_core(coverage)
        richie = audit["sequence_ledger"]["climax"][0]
        ground_sequence_row_for_test(
            richie,
            page=5,
            actor="Richie",
            action="Richie chooses Lucesita before the result changes.",
            knowledge="Richie knows he chose Lucesita.",
            audience="The audience sees Richie choose Lucesita.",
        )
        expose = copy.deepcopy(richie)
        ground_sequence_row_for_test(
            expose,
            page=6,
            actor="Diego",
            action="Diego plays the exposé and overturns the corrupt result.",
            knowledge="Diego knows the corrupt result is overturned.",
            audience=(
                "The audience sees Diego play the exposé and overturn "
                "the corrupt result."
            ),
        )
        audit["sequence_ledger"]["climax"].append(expose)
        normalized_audit = cv.normalize_audit_tool_input(
            copy.deepcopy(audit), range(1, 7)
        )
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (audit, settled_usage()),
                (
                    supported_detail_payload(
                        coverage,
                        normalized_audit,
                        COSQUILLITAS_SEQUENCE_TEXT,
                    ),
                    settled_usage(),
                ),
            ]
        )

        report, _usage = run_engine(
            new_store(), transport, text=COSQUILLITAS_SEQUENCE_TEXT
        )

        self.assertEqual(
            [call["stage"] for call in transport.calls],
            [
                "coverage_v1.coverage",
                "coverage_v1.fact_audit",
                "coverage_v1.fact_audit_details",
            ],
        )
        self.assertEqual(
            [row["page"] for row in report["fact_audit"]["sequence_ledger"]],
            [5, 6, 6, 6, 6, 6],
        )
        self.assertEqual(
            [row["phase"] for row in report["fact_audit"]["sequence_ledger"][:2]],
            ["climax", "climax"],
        )
        self.assertEqual(report["status"], "sealed")

    def test_cosquillitas_early_ending_is_reclassified_before_detail_audit(self):
        coverage = valid_coverage()
        audit = provider_audit_core(coverage)
        apparent_loss = audit["sequence_ledger"]["climax"][0]
        ground_sequence_row_for_test(
            apparent_loss,
            page=4,
            actor="Román Vega",
            action="Román Vega creates an apparent loss with corrupt scores.",
            knowledge="Román Vega knows the result is false.",
            audience=(
                "The audience watches as Román Vega creates an apparent loss with "
                "corrupt scores."
            ),
        )
        expose = copy.deepcopy(apparent_loss)
        ground_sequence_row_for_test(
            expose,
            page=6,
            actor="Diego",
            action="Diego plays the exposé and overturns the corrupt result.",
            knowledge="Diego knows the corrupt result is overturned.",
            audience=(
                "The audience sees Diego play the exposé and overturn "
                "the corrupt result."
            ),
        )
        audit["sequence_ledger"]["climax"].append(expose)
        richie = audit["sequence_ledger"]["ending"][0]
        ground_sequence_row_for_test(
            richie,
            page=5,
            actor="Richie",
            action="Richie receives the wig before the exposé.",
            knowledge="Richie knows he received the wig.",
            audience="The audience sees Richie receive the wig.",
        )
        coda = copy.deepcopy(richie)
        ground_sequence_row_for_test(
            coda,
            page=6,
            actor="Diego and the winners",
            action=(
                "Diego and the winners begin their post-climax celebration."
            ),
            knowledge="Diego knows the contest is over.",
            audience=(
                "The audience sees Diego and the winners begin their "
                "post-climax celebration."
            ),
        )
        audit["sequence_ledger"]["ending"].append(coda)
        normalized_audit = cv.normalize_audit_tool_input(
            copy.deepcopy(audit), range(1, 7)
        )
        corrected = copy.deepcopy(coverage)
        corrected["story_spine"]["climax"] += (
            "; Richie receives the wig before the exposé"
        )
        corrected["synopsis"] += (
            " Richie receives the wig before the exposé overturns the result."
        )
        reaudited = supported_audit(corrected)
        reaudited["sequence_ledger"] = normalized_audit["sequence_ledger"]
        reaudited["sequence_normalization_diagnostics"] = normalized_audit[
            "sequence_normalization_diagnostics"
        ]
        prior_audit = completed_audit_fixture(
            coverage, normalized_audit, COSQUILLITAS_SEQUENCE_TEXT
        )
        pending_detail = pending_reaudit_detail_payload(
            coverage,
            prior_audit,
            corrected,
            normalized_audit["sequence_ledger"],
            COSQUILLITAS_SEQUENCE_TEXT,
        )
        transport = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (
                supported_detail_payload(
                    coverage,
                    normalized_audit,
                    COSQUILLITAS_SEQUENCE_TEXT,
                ),
                settled_usage(),
            ),
            (corrected, settled_usage()),
            (reaudited, settled_usage()),
            (pending_detail, settled_usage()),
        ])

        report, _usage = run_engine(
            new_store(), transport, text=COSQUILLITAS_SEQUENCE_TEXT
        )

        self.assertEqual(
            [call["stage"] for call in transport.calls],
            [
                "coverage_v1.coverage",
                "coverage_v1.fact_audit",
                "coverage_v1.fact_audit_details",
                "coverage_v1.fact_repair",
                "coverage_v1.fact_reaudit",
                "coverage_v1.fact_reaudit_details",
            ],
        )
        ledger = report["fact_audit"]["sequence_ledger"]
        richie_index = next(
            index for index, row in enumerate(ledger)
            if row["action"].startswith("Richie receives")
        )
        self.assertEqual(ledger[richie_index]["page"], 5)
        self.assertEqual(ledger[richie_index]["phase"], "climax")
        self.assertEqual(
            ledger[richie_index]["phase_normalized_from"], "ending"
        )
        self.assertEqual(
            ledger[richie_index + 1]["action"],
            "Diego plays the exposé and overturns the corrupt result.",
        )

    def test_fact_reaudit_preserves_reclassified_climax_beat(self):
        coverage = valid_coverage()
        audit = provider_audit_core(coverage)
        first = audit["sequence_ledger"]["climax"][0]
        ground_sequence_row_for_test(
            first,
            page=4,
            actor="Román Vega",
            action="Román Vega creates an apparent loss with corrupt scores.",
            knowledge="Román Vega knows the result is false.",
            audience=(
                "The audience watches as Román Vega creates an apparent "
                "loss with corrupt scores."
            ),
        )
        expose = copy.deepcopy(first)
        ground_sequence_row_for_test(
            expose,
            page=6,
            actor="Diego",
            action="Diego plays the exposé and overturns the corrupt result.",
            knowledge="Diego knows the corrupt result is overturned.",
            audience=(
                "The audience sees Diego play the exposé and overturn "
                "the corrupt result."
            ),
        )
        audit["sequence_ledger"]["climax"].append(expose)
        richie = audit["sequence_ledger"]["ending"][0]
        ground_sequence_row_for_test(
            richie,
            page=5,
            actor="Richie",
            action="Richie receives the wig before the exposé.",
            knowledge="Richie knows he received the wig.",
            audience="The audience sees Richie receive the wig.",
        )
        audit["sequence_ledger"]["ending"].append(copy.deepcopy(expose))
        normalized_audit = cv.normalize_audit_tool_input(
            copy.deepcopy(audit), range(1, 7)
        )
        corrected = copy.deepcopy(coverage)
        corrected["story_spine"]["climax"] += "; Richie receives the wig"
        corrected["synopsis"] += " Richie receives the wig before the exposé."
        prior_audit = completed_audit_fixture(
            coverage, normalized_audit, COSQUILLITAS_SEQUENCE_TEXT
        )
        pending_detail = pending_reaudit_detail_payload(
            coverage,
            prior_audit,
            corrected,
            normalized_audit["sequence_ledger"],
            COSQUILLITAS_SEQUENCE_TEXT,
        )
        transport = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (
                supported_detail_payload(
                    coverage,
                    normalized_audit,
                    COSQUILLITAS_SEQUENCE_TEXT,
                ),
                settled_usage(),
            ),
            (corrected, settled_usage()),
            # The generic ledger omits the reclassified page-5 beat.
            (supported_audit(corrected), settled_usage()),
            (pending_detail, settled_usage()),
        ])

        report, _usage = run_engine(
            new_store(), transport, text=COSQUILLITAS_SEQUENCE_TEXT
        )

        self.assertEqual(report["status"], "sealed")
        repair = report["diagnostics"]["fact_repair"]
        self.assertTrue(repair["applied"])
        self.assertTrue(any(
            row["page"] == 5
            and row["action"] == "Richie receives the wig before the exposé."
            for row in report["fact_audit"]["sequence_ledger"]
        ))

    def test_cosquillitas_aggregate_sequence_row_cannot_hide_earlier_action(self):
        coverage = valid_coverage()
        audit = provider_audit_core(coverage)
        row = audit["sequence_ledger"]["ending"][0]
        row["page"] = 6
        row["action"] = (
            "Richie chooses Lucesita and receives the wig on pp.4-5; "
            "the pregnancy is announced on p.6."
        )

        normalized = cv.normalize_audit_tool_input(audit, range(1, 7))

        self.assertTrue(any(
            "ending beat is anchored to page 6 but begins on referenced page 4"
            in error
            for error in normalized["_sequence_normalization_errors"]
        ))

    def test_parenthetical_history_does_not_move_current_action_anchor(self):
        coverage = valid_coverage()
        audit = provider_audit_core(coverage)
        row = audit["sequence_ledger"]["climax"][0]
        row["page"] = 6
        row["action"] = (
            "The judges post their scores on p.6 "
            "(as instructed, seen earlier on p.4)."
        )

        normalized = cv.normalize_audit_tool_input(audit, range(1, 7))

        self.assertFalse(any(
            "anchored to page 6 but begins on referenced page 4" in error
            for error in normalized.get("_sequence_normalization_errors", [])
        ))

    def test_sequence_span_ending_on_last_climax_page_is_reclassified(self):
        coverage = valid_coverage()
        audit = provider_audit_core(coverage)
        climax = audit["sequence_ledger"]["climax"][0]
        climax["page"] = 97
        climax["action"] = "The exposé plays on p.97."
        early = audit["sequence_ledger"]["ending"][0]
        early["page"] = 95
        early["action"] = "Richie chooses and receives the wig on pp.95-97."
        coda = copy.deepcopy(early)
        coda["page"] = 98
        coda["action"] = "The real ending begins on p.98."
        audit["sequence_ledger"]["ending"] = [early, coda]
        audit["sequence_ledger"]["final_scene"][0]["page"] = 98
        for phase in ("tag", "aftermath"):
            marker = audit["sequence_ledger"][phase][0]
            for field in cv.GROUNDED_SEQUENCE_FIELDS:
                marker[field] = "NOT PRESENT"
            marker["page"] = 0

        normalized = cv.normalize_audit_tool_input(audit, range(1, 99))

        self.assertFalse(any(
            "crosses the final climax boundary" in error
            for error in normalized.get("_sequence_normalization_errors", [])
        ))
        richie = next(
            row for row in normalized["sequence_ledger"]
            if row["action"].startswith("Richie chooses")
        )
        self.assertEqual(richie["phase"], "climax")
        self.assertEqual(richie["phase_normalized_from"], "ending")
        guard = next(
            row for row in normalized["verdicts"]
            if row["claim_id"] == "guard.cross_field_consistency"
        )
        self.assertEqual(guard["classification"], "partially_supported")

    def test_sequence_row_rejects_page_history_hidden_outside_action(self):
        coverage = valid_coverage()
        audit = provider_audit_core(coverage)
        row = audit["sequence_ledger"]["climax"][0]
        row["page"] = 6
        row["action"] = "They sing, judges score, and a video appears."
        row["result"] = (
            "Singing begins p.2; scores land p.5; video appears p.6."
        )
        row["character_knowledge"] = "The scheme was known on p.4."

        normalized = cv.normalize_audit_tool_input(audit, range(1, 7))

        errors = normalized["_sequence_normalization_errors"]
        self.assertTrue(any("result page reference falls outside" in e for e in errors))
        self.assertTrue(any(
            "character_knowledge page reference falls outside" in e
            for e in errors
        ))

        row["page"] = 2
        row["action"] = "The single event unfolds across pp.2-5."
        row["result"] = "Its result lands on p.5."
        row["character_knowledge"] = "They understand it on p.4."
        normalized = cv.normalize_audit_tool_input(audit, range(1, 7))
        self.assertFalse(any(
            "falls outside action interval" in error
            for error in normalized.get("_sequence_normalization_errors", [])
        ))

    def test_sequence_prompt_requires_atomic_rows_and_earliest_page_anchor(self):
        blocks = cv.build_audit_user_blocks(
            SCREENPLAY_TEXT,
            "El último portero",
            cv.build_audit_claims(valid_coverage()),
            coverage=valid_coverage(),
            page_reference_map=cv.build_page_reference_map(
                SCREENPLAY_TEXT, 6, None
            ),
            evidence_checks=cv.build_existing_evidence_checks(
                valid_coverage(), SCREENPLAY_TEXT
            ),
            sequence_focus=cv.build_sequence_focus(SCREENPLAY_TEXT),
        )
        instruction = str(blocks[-1]["text"])

        self.assertIn("one material event per row", instruction)
        self.assertIn("earliest printed page", instruction)

    def test_sequence_ledger_rejects_unverified_numeric_actor_shorthand(self):
        coverage = valid_coverage()
        audit = supported_audit(coverage)
        audit["sequence_ledger"][0]["actor"] = "Three judges"

        problems = cv.validate_audit_payload(
            audit,
            cv.build_audit_claims(coverage),
            coverage,
            cv.build_page_reference_map(SCREENPLAY_TEXT, 6, None),
            cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT),
        )

        self.assertIn(
            "sequence_ledger[0].actor uses unverified numeric shorthand; "
            "name the actors or roles",
            problems,
        )

    def test_sequence_ledger_routes_invalid_knowledge_claims_to_repair(self):
        coverage = valid_coverage()
        problem = (
            "sequence_ledger[0].character_knowledge has invalid knowledge "
            "structure; use one knower roster and exactly one knowledge "
            "predicate"
        )
        for claim in (
            "Carlos",
            "Carlos knows the result (runners are aware too).",
        ):
            with self.subTest(claim=claim):
                audit = supported_audit(coverage)
                audit["sequence_ledger"][0]["character_knowledge"] = claim
                problems = cv.validate_audit_payload(
                    audit,
                    cv.build_audit_claims(coverage),
                    coverage,
                    cv.build_page_reference_map(SCREENPLAY_TEXT, 6, None),
                    cv.build_existing_evidence_checks(
                        coverage, SCREENPLAY_TEXT
                    ),
                )

                self.assertIn(problem, problems)
                self.assertTrue(
                    cv._audit_problems_need_only_sequence_retry(problems)
                )

    def test_knowledge_parser_handles_awareness_and_seeking_literally(self):
        self.assertTrue(cv._has_exactly_one_knowledge_claim(
            "Cosquillitas are terrified and aware that the public hates them"
        ))
        self.assertTrue(cv._has_exactly_one_knowledge_claim(
            "Anita learns that her father returned and is seeking reconciliation"
        ))
        self.assertFalse(cv._has_exactly_one_knowledge_claim(
            "Cosquillitas are terrified by the crowd"
        ))
        self.assertFalse(cv._has_exactly_one_knowledge_claim(
            "The judges execute a predetermined bribery scheme"
        ))

    def test_numbered_human_roles_require_generic_roster_and_count_ledger(self):
        self.assertTrue(cv._sequence_has_unverified_numeric_shorthand(
            "Judge 1, Judge 2, Judge 3, and Judge 4"
        ))
        for value in (
            "Four judges",
            "In Act 3 the panel posts its scores",
            "Scene 4",
            "Page 94",
            "Round 2",
        ):
            with self.subTest(value=value):
                self.assertTrue(
                    cv._sequence_has_unverified_numeric_shorthand(value)
                )
        self.assertEqual(
            cv._numbered_sequence_role_roster(
                "Judge 1, Judge 2, Judge 3, and Judge 4 post scores"
            ),
            "The judges",
        )
        self.assertEqual(
            cv._numbered_sequence_role_group(
                "Judge 3 scores, then Judge 4 scores"
            ),
            ("The judges", "judges", 2),
        )
        self.assertEqual(
            cv._numbered_sequence_role_group(
                "Jugadora 1, Jugadora 2, Jugadora 3 y Jugadora 4 anotan"
            ),
            ("Las jugadoras", "jugadoras", 4),
        )
        self.assertEqual(
            cv._sequence_numbered_role_count_subject(
                {
                    "order": 1,
                    "page": 4,
                    "action": (
                        "Jugadora 1, Jugadora 2, Jugadora 3 y "
                        "Jugadora 4 anotan"
                    ),
                },
                4,
            )["claimed_total"],
            4,
        )
        self.assertEqual(
            cv._numbered_sequence_role_roster(
                "In Act 3 the panel posts its scores"
            ),
            "",
        )

    def test_ambiguous_numbered_role_actions_fail_closed(self):
        coverage = valid_coverage()
        claims = cv.build_audit_claims(coverage)
        page_map = cv.build_page_reference_map(SCREENPLAY_TEXT, 6, None)
        evidence = cv.build_existing_evidence_checks(
            coverage, SCREENPLAY_TEXT
        )
        for action in (
            "Judge 1, 2, 3, and 4 post scores.",
            "Judge 1, Judge 2, 3, and 4 post scores.",
            "Judge 1 / Judge 2 / 3 / 4 post scores.",
            "Judge 1 & Judge 2 & 3 & 4 post scores.",
            "Judge 1, Judge 2; 3; 4 post scores.",
            "Judge 1, Judge 2: 3: 4 post scores.",
            "Judge 1, Judge 2 | 3 | 4 post scores.",
            "Judge 1 plus Judge 2 plus 3 plus 4 post scores.",
            "Judge 1, Judge 2 or 3 post scores.",
            "Juez 1, Juez 2 o 3 califican.",
            "Judge 1 or Judge 2 posts the deciding score.",
            "Juez 1 o Juez 2 publica la calificacion decisiva.",
            "Judge 1 and/or Judge 2 posts the deciding score.",
            "Neither Judge 1 nor Judge 2 posts a score.",
            "Ni Juez 1 ni Juez 2 califica.",
            "Judge 1, but not Judge 2, posts a score.",
            "Juez 1, pero no Juez 2, publica una calificacion.",
            "Judge 1 and Judge 2 do not post scores.",
            "Juez 1 y Juez 2 no califican.",
            "Judge 1 and Judge 2 are absent.",
            "Judge 1 and Judge 2 post scores, but neither qualifies.",
            "Judge 1 watches Judge 2 post the deciding score.",
            "Referee 1 and Referee 2 post scores.",
            "Referee 1 and referee 2 post scores.",
            "referee 1 and referee 2 post scores.",
            "Árbitro 1 y árbitro 2 califican.",
            "Referees 1-4 post scores.",
            "Jueces N.º 1-4 califican.",
            "Judge 1, Judge 2, and No. 3 post scores.",
            "First Referee and Second Referee post scores.",
            "Primer Árbitro y Segundo Árbitro califican.",
            "Four referees post scores.",
            "Four corrupt judges post scores.",
            "The four bribed judges post scores.",
            "Four of the corrupt judges post scores.",
            "Four corrupt referees post scores.",
            "Four corrupt-looking judges post scores.",
            "Four exceptionally deeply thoroughly corrupt judges post scores.",
            "Cuatro árbitros califican.",
            "At least Judge 1 and Judge 2 post scores.",
            "Al menos Juez 1 y Juez 2 califican.",
            "Judge 1 and Judge 2 post scores, among others.",
            "Juez 1 y Juez 2 califican, entre otros.",
            "Judge 1 and Judge 2 post scores, etc.",
            "Judge 1 and Judge 2, plus others, post scores.",
            "Judge 1 and Judge 2 and more judges post scores.",
            "Juez 1 y Juez 2, además de otros, califican.",
            "Juez 1 y Juez 2 y los demás califican.",
            "Judge 1, among others, and Judge 2 post scores.",
            "Juez 1, entre otros, y Juez 2 califican.",
            "Judge 1 and Judge 2 post scores, with more judges participating.",
            "Juez 1 y Juez 2 califican, con más jueces participando.",
            "Judge 1 and Judge 2 post scores, with one more judge participating.",
            "Juez 1 y Juez 2 califican, con un juez más participando.",
            "Judge 1 and Judge 2 post scores, with another judge participating.",
            "The judges include Judge 1 and Judge 2.",
            "Los jueces incluyen al Juez 1 y Juez 2.",
            "Judges such as Judge 1 and Judge 2 post scores.",
            "Jueces como Juez 1 y Juez 2 califican.",
            "For example, Judge 1 and Judge 2 post scores.",
            "Por ejemplo, Juez 1 y Juez 2 califican.",
            "Some judges, Judge 1 and Judge 2, post scores.",
            "Judge 1 and Judge 2 post scores, among many.",
            "Juez 1 y Juez 2 califican, entre varios.",
            "Judge 1 and Judge 2 post scores, to name a few.",
            "For instance, Judge 1 and Judge 2 post scores.",
            "E.g., Judge 1 and Judge 2 post scores.",
            "Judge 1 and Judge 2 are some of the judges.",
            "Judge 1 and Judge 2 are among the judges.",
            "Judge 1 and Judge 2, along with others, post scores.",
            "Judge 1 and Judge 2, together with others, post scores.",
            "Judge 1 and Judge 2, as well as others, post scores.",
            "Juez 1 y Juez 2, junto con otros, califican.",
            "Además de Juez 1 y Juez 2, otros califican.",
            "Judge 1 and Judge 2 are in a four-judge panel.",
            "At a minimum, Judge 1 and Judge 2 post scores.",
            "At minimum, Judge 1 and Judge 2 post scores.",
            "Como poco, Juez 1 y Juez 2 califican.",
            "Judge 1 and Judge 2 don't post scores.",
            "Judge 1 and Judge 2 cannot post scores.",
            "Judge 1 and Judge 2 can't post scores.",
            "Judge 1 and Judge 2 never post scores.",
            "Juez 1 y Juez 2 nunca califican.",
            "Juez 1 y Juez 2 tampoco califican.",
            "Judge 1 and Judge 2 fail to post scores.",
            "Judge 1 and Judge 2 are among those who score.",
            "Judge 1 and Judge 2 are part of the panel.",
            "Judge 1 and Judge 2 might post scores.",
            "Judge 1 and Judge 2 and Carlos post scores.",
            "Juez 1 y Juez 2 y Carlos califican.",
            "Judge 1 and Judge 2, plus Carlos, post scores.",
            "Judge 1 and Judge 2 with Carlos post scores.",
            "Judge 1 and Judge 2 alongside Carlos post scores.",
            "Judge 1 and Judge 2 together with Carlos post scores.",
            "Judge 1 and Judge 2 as well as Carlos post scores.",
            "Juez 1 y Juez 2 junto con Carlos califican.",
            "Juez 1 y Juez 2 con Carlos califican.",
            "Judge 1 and Judge 2 along with Carlos post scores.",
            "Judge 1 and Judge 2 with carlos post scores.",
            "Judge 1, Judge 2, Carlos, and Anita post scores.",
            "Juez 1, Juez 2, Carlos y Anita califican.",
            "Judge 1 and Judge 2 with him post scores.",
            "Juez 1 y Juez 2 con él califican.",
            "Judge 1 and Judge 2 haven't posted scores.",
            "Judge 1 and Judge 2 shouldn't post scores.",
            "Judge 1 and Judge 2 mustn't post scores.",
            "Judge 1 and Judge 2 refuse to post scores.",
            "Judge 1 and Judge 2 refrain from posting scores.",
            "Juez 1 y Juez 2 se niegan a calificar.",
            "Judge 1 and Judge 2 can post scores.",
            "Judge 1 and Judge 2 should post scores.",
            "Judge 1 and Judge 2 will post scores.",
            "Judge 1 and Judge 2 try to post scores.",
            "Judge 1 and Judge 2 almost post scores.",
            "Juez 1 y Juez 2 deben calificar.",
            "Juez 1 y Juez 2 intentan calificar.",
            "Juez 1 y Juez 2 casi califican.",
            "Judge 1 and Judge 2 must post scores.",
            "Judge 1 and Judge 2 plan to post scores.",
            "Juez 1 y Juez 2 planean calificar.",
            "Judge 1 and Judge 2 reportedly post scores.",
            "Judge 1 and Judge 2 allegedly post scores.",
            "Judge 1 and Judge 2 supposedly post scores.",
            "Judge 1 and Judge 2 seemingly post scores.",
            "Judge 1 and Judge 2 appear to post scores.",
            "Judge 1 and Judge 2 are said to post scores.",
            "Juez 1 y Juez 2 supuestamente califican.",
            "Juez 1 y Juez 2 al parecer califican.",
            "Juez 1 y Juez 2 aparentemente califican.",
            "Juez 1 y Juez 2 parecen calificar.",
            "Judge 1 and Judge 2 post scores if Tony pays them.",
            "Juez 1 y Juez 2 califican si Tony les paga.",
            "Judge 1 and Judge 2 post scores provided that Tony pays them.",
            "Juez 1 y Juez 2 califican siempre que Tony les pague.",
            "Judge 1 and Judge 2 post scores, amongst others.",
            "Judge 1 and Judge 2 post scores, et al.",
            "Judge 1 and Judge 2, plus several unnamed judges, post scores.",
            "Judge 1 and Judge 2 with unnamed judges post scores.",
            "Judge 1 and Judge 2 are joined by unnamed judges.",
            "Judge 1 and Judge 2 represent a subset of the panel.",
            "Judge 1 and Judge 2 comprise part of the panel.",
            "Judge 1 and Judge 2 are among a larger group of judges.",
            (
                "Judge 1 gives 10, Judge 2 gives 10, Judge 3 gives 5, "
                "and 4 gives 2."
            ),
            "Judge 1 gives 10, Judge 2 gives 5, and 3 gives 2.",
            (
                "Judge 1 gives 10, Judge 2 gives 5, and 3 on page 6 "
                "gives 2."
            ),
            "Judge 1 gives 10, Judge 2 gives 5, and 3 from the left gives 2.",
            "Judge 1 gives 10, Judge 2 gives 5, and 3 to Tony gives 2.",
            (
                "Juez 1 da 10, Juez 2 da 5, y 3 en la pagina 6 da 2."
            ),
            "Judge 1 gives 10, Judge 2 gives 5, and 3 from the left dissents.",
            "Juez 1 da 10, Juez 2 da 5, y 3 desde la izquierda disiente.",
            "Judge 1 and Juez 2 post scores.",
            "First Judge, Second Judge, Three, and Fourth Judge post scores.",
            "Judges 1-4 post scores.",
            "Judges One through Four post scores.",
            "Judge 1, Judge 2, and Judges 3-4 post scores.",
            "Judge 1 and Judge 2 score beside Judges 3-4.",
            "Judge 1 and Judge 2 score; Judges 3-4 score next.",
            "Judge 1 and Judge 2 score alongside the four judges.",
            "Four judges post scores.",
            "Five judges post scores.",
            "The four judges post scores.",
            "Los cuatro jueces califican.",
            "A quartet of judges posts scores.",
            "Both judges post scores.",
        ):
            audit = supported_audit(coverage)
            audit["sequence_ledger"][0]["actor"] = "The judges"
            audit["sequence_ledger"][0]["action"] = action

            problems = cv.validate_audit_payload(
                audit, claims, coverage, page_map, evidence
            )

            with self.subTest(action=action):
                self.assertTrue(any(
                    "action uses ambiguous numbered-role shorthand" in problem
                    for problem in problems
                ))
                self.assertFalse(any(
                    row["subject"].get("trigger") == "counting_claim"
                    for row in cv.build_detail_audit_rows(
                        coverage, evidence, audit["sequence_ledger"]
                    )
                ))

        for action, expected_group in (
            (
                "Judge 1 and Judge 2 give scores of 5 and 2.",
                ("The judges", "judges", 2),
            ),
            (
                "Juez 1 y Juez 2 califican con 5 y 2.",
                ("Los jueces", "jueces", 2),
            ),
            (
                "Judge 1 scores, followed by Judge 2.",
                ("The judges", "judges", 2),
            ),
            (
                "Juez 1 califica, seguido por Juez 2.",
                ("Los jueces", "jueces", 2),
            ),
            (
                "Judge 1 and Judge 2 each give at least 5 points.",
                ("The judges", "judges", 2),
            ),
            (
                "Judge 1 and Judge 2 post scores, including a perfect 10.",
                ("The judges", "judges", 2),
            ),
            (
                "Judge 1 and Judge 2 include Tony in the decision.",
                ("The judges", "judges", 2),
            ),
            (
                "On page 94, Judge 1 and Judge 2 post scores.",
                ("The judges", "judges", 2),
            ),
            (
                "Simultaneously, Judge 1 and Judge 2 post scores.",
                ("The judges", "judges", 2),
            ),
            (
                "On pp.94-95, Judge 1 and Judge 2 post scores.",
                ("The judges", "judges", 2),
            ),
            (
                "First, Judge 1 and Judge 2 post scores.",
                ("The judges", "judges", 2),
            ),
            (
                "Juez 1 y Jueza 2 califican.",
                ("Los jueces", "jueces", 2),
            ),
            (
                "Jugador 1 y Jugadora 2 anotan.",
                ("Los jugadores", "jugadores", 2),
            ),
            (
                "Juez N.º1 y Juez N.º2 califican.",
                ("Los jueces", "jueces", 2),
            ),
            (
                "Juez N°1 y Juez N°2 califican.",
                ("Los jueces", "jueces", 2),
            ),
            (
                "Judge No.1 and Judge No.2 post scores.",
                ("The judges", "judges", 2),
            ),
            (
                "Judge 1 and Judge 2 give scores of 5 and 2 to decide "
                "the winner.",
                ("The judges", "judges", 2),
            ),
            (
                "Judge 1 and Judge 2 give scores of 5 and 2 in the "
                "final round.",
                ("The judges", "judges", 2),
            ),
            (
                "Judge 1 and Judge 2 give scores of 5 and 2, enough "
                "to win.",
                ("The judges", "judges", 2),
            ),
            (
                "Judge 1 and Judge 2 tell Carlos the score.",
                ("The judges", "judges", 2),
            ),
            (
                "Judge 1 and Judge 2 execute the scheme arranged by "
                "Tony.",
                ("The judges", "judges", 2),
            ),
            (
                "Award rigged scores: Judge 1 gives 10, Judge 2 gives 10, "
                "Judge 3 (briefed by Tony) gives 5, Judge 4 (bribed) gives "
                "2 (as per Tony's instruction, seen earlier on p. 87)",
                ("The judges", "judges", 4),
            ),
        ):
            audit = supported_audit(coverage)
            audit["sequence_ledger"][0]["actor"] = "The judges"
            audit["sequence_ledger"][0]["action"] = action

            problems = cv.validate_audit_payload(
                audit, claims, coverage, page_map, evidence
            )

            with self.subTest(action=action):
                self.assertFalse(any(
                    "action uses ambiguous numbered-role shorthand" in problem
                    for problem in problems
                ))
                self.assertEqual(
                    cv._numbered_sequence_role_group(action),
                    expected_group,
                )

        for action in (
            "Carlos gives 5 and Anita gives 2.",
            "Carlos da 5 y Anita da 2.",
            "Carlos califica con 5 y Anita califica con 2.",
            "The score is 5 and the rating is 2.",
            "Carlos rates it 5 and Anita rates it 2.",
            "Carlos gives him 5 and Anita gives him 2.",
            "Los Chavos win 3-2.",
            "They win 3 to 2.",
            "The match ends 3-2.",
            "Diego scores to make it 3-2.",
            "They tie 2-2.",
            "Four red cars arrive.",
            "Four cars hit corrupt judges.",
            "Two bells ring, then Carlos scores.",
            "Dos campanas suenan, luego Carlos califica.",
            "Once judges arrive, the contest begins.",
            (
                "Announces that the peso has strengthened so that one peso "
                "now equals three dollars."
            ),
        ):
            audit = supported_audit(coverage)
            audit["sequence_ledger"][0]["action"] = action
            problems = cv.validate_audit_payload(
                audit, claims, coverage, page_map, evidence
            )
            with self.subTest(score_action=action):
                self.assertFalse(cv._sequence_action_has_role_count_syntax(
                    action
                ))
                self.assertFalse(any(
                    "action uses ambiguous numbered-role shorthand" in problem
                    for problem in problems
                ))

        lowercase_action = (
            "Judge 1, Judge 2, and judge 3 post scores."
        )
        lowercase_beat = {
            "order": 1,
            "phase": "climax",
            "actor": "The judges",
            "action": lowercase_action,
            "result": "The judges decide the contest.",
            "character_knowledge": "NOT LOCATED",
            "audience_knowledge": "The audience sees the scores.",
            "page": 6,
        }
        lowercase_subject = cv._sequence_numbered_role_count_subject(
            lowercase_beat, 6
        )
        self.assertIsNotNone(lowercase_subject)
        self.assertEqual(
            lowercase_subject["claimed_role_identities"], [1, 2, 3]
        )
        for action in (
            (
                "First Judge, Second Judge, Third Judge, and Fourth Judge "
                "post scores."
            ),
            (
                "Judge One, Judge Two, Judge Three, and Judge Four "
                "post scores."
            ),
            (
                "Primer Juez, Segundo Juez, Tercer Juez y Cuarto Juez "
                "dan notas."
            ),
        ):
            word_beat = {**lowercase_beat, "action": action}
            word_subject = cv._sequence_numbered_role_count_subject(
                word_beat, 6
            )
            with self.subTest(word_action=action):
                self.assertIsNotNone(word_subject)
                self.assertEqual(
                    word_subject["claimed_role_identities"], [1, 2, 3, 4]
                )

        abbreviation_subject = cv._sequence_numbered_role_count_subject(
            {
                **lowercase_beat,
                "action": "Juez N.º 1 y Juez N.º 2 califican.",
            },
            6,
        )
        self.assertIsNotNone(abbreviation_subject)
        self.assertEqual(
            abbreviation_subject["claimed_role_identities"], [1, 2]
        )

    def test_provider_shaped_fact_repair_reuses_unchanged_details(self):
        coverage = valid_coverage()
        audit = provider_audit_core(coverage)
        audit["verdicts"][0]["classification"] = "partially_supported"
        audit["verdicts"][0]["note"] = "The protagonist wording is imprecise."
        corrected = copy.deepcopy(coverage)
        corrected["story_spine"]["protagonist"] = (
            "Diego Salas, portero retirado de 58 años"
        )
        transport = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (supported_detail_payload(coverage), settled_usage()),
            (corrected, settled_usage()),
            (provider_audit_core(corrected), settled_usage()),
        ])

        report, _usage = run_engine(new_store(), transport)

        self.assertEqual(report["status"], "sealed")
        self.assertEqual(report["cost"]["call_count"], 5)
        self.assertEqual(
            [call["stage"] for call in transport.calls],
            [
                "coverage_v1.coverage",
                "coverage_v1.fact_audit",
                "coverage_v1.fact_audit_details",
                "coverage_v1.fact_repair",
                "coverage_v1.fact_reaudit",
            ],
        )

    def test_paid_cosquillitas_shape_normalizes_after_coverage_repair(self):
        broken = valid_coverage()
        del broken["development_priorities"]
        coverage = valid_coverage()
        audit = provider_audit_core(coverage)
        apparent_loss = audit["sequence_ledger"]["climax"][0]
        ground_sequence_row_for_test(
            apparent_loss,
            page=3,
            actor="Román Vega",
            action="Román Vega creates an apparent loss with corrupt scores.",
            knowledge="Román Vega knows the result is false.",
            audience=(
                "The audience watches as Román Vega creates an apparent "
                "loss with corrupt scores."
            ),
        )
        expose = copy.deepcopy(apparent_loss)
        ground_sequence_row_for_test(
            expose,
            page=5,
            actor="Diego",
            action="Diego plays the exposé and overturns the corrupt result.",
            knowledge="Diego knows the corrupt result is overturned.",
            audience=(
                "The audience sees Diego play the exposé and overturn "
                "the corrupt result."
            ),
        )
        audit["sequence_ledger"]["climax"].append(expose)
        trophy = audit["sequence_ledger"]["ending"][0]
        ground_sequence_row_for_test(
            trophy,
            page=6,
            actor="Diego",
            action="Diego completes the ending with the trophy celebration.",
            knowledge="Diego knows the ending is complete.",
            audience=(
                "The audience watches as Diego completes the ending with "
                "the trophy celebration."
            ),
        )
        richie = copy.deepcopy(trophy)
        ground_sequence_row_for_test(
            richie,
            page=4,
            actor="Richie",
            action="Richie receives the wig before the exposé.",
            knowledge="Richie knows he received the wig.",
            audience="The audience sees Richie receive the wig.",
        )
        celebration = copy.deepcopy(trophy)
        ground_sequence_row_for_test(
            celebration,
            page=5,
            actor="Diego and the winners",
            action="Diego and the winners celebrate their victory.",
            knowledge="Diego knows the contest is over.",
            audience=(
                "The audience sees Diego and the winners celebrate their victory."
            ),
        )
        audit["sequence_ledger"]["ending"] = [
            trophy, richie, celebration,
        ]
        audit["sequence_ledger"]["final_scene"][0]["page"] = 6
        for phase, sentinel in (("tag", 0), ("aftermath", 99)):
            marker = audit["sequence_ledger"][phase][0]
            for field in cv.GROUNDED_SEQUENCE_FIELDS:
                marker[field] = "NOT PRESENT"
            marker["page"] = sentinel
        normalized_audit = cv.normalize_audit_tool_input(
            copy.deepcopy(audit), range(1, 7)
        )
        corrected = copy.deepcopy(coverage)
        corrected["story_spine"]["climax"] += (
            "; Richie receives the wig before the exposé"
        )
        corrected["synopsis"] += (
            " Richie receives the wig before the exposé overturns the result."
        )
        provider_reaudit = provider_audit_core(corrected)
        provider_reaudit["sequence_ledger"] = {
            phase: [
                {
                    key: value
                    for key, value in row.items()
                    if key not in {
                        "order", "phase", "phase_normalized_from",
                        "phase_input_order", "page_normalized_from",
                    }
                }
                for row in normalized_audit["sequence_ledger"]
                if row["phase"] == phase
            ]
            for phase in (
                "climax", "ending", "final_scene", "tag", "aftermath"
            )
        }
        corrected_rows = cv.build_detail_audit_rows(
            corrected,
            cv.build_existing_evidence_checks(
                corrected, COSQUILLITAS_SEQUENCE_TEXT
            ),
            normalized_audit["sequence_ledger"],
        )
        _seeded_evidence, _seeded_citations, pending_rows = (
            cv._reusable_detail_seed(
                coverage,
                cv.build_existing_evidence_checks(
                    coverage, COSQUILLITAS_SEQUENCE_TEXT
                ),
                completed_audit_fixture(
                    coverage,
                    normalized_audit,
                    COSQUILLITAS_SEQUENCE_TEXT,
                ),
                corrected_rows,
            )
        )
        pending_detail = detail_payload_for_rows(
            pending_rows, COSQUILLITAS_SEQUENCE_TEXT
        )
        transport = FakeTransport([
            (broken, settled_usage()),
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (
                supported_detail_payload(
                    coverage,
                    normalized_audit,
                    COSQUILLITAS_SEQUENCE_TEXT,
                ),
                settled_usage(),
            ),
            (corrected, settled_usage()),
            (provider_reaudit, settled_usage()),
            (pending_detail, settled_usage()),
        ])

        report, _usage = run_engine(
            new_store(), transport, text=COSQUILLITAS_SEQUENCE_TEXT
        )

        self.assertEqual(report["status"], "sealed")
        self.assertEqual(report["cost"]["repair_calls_used"], 1)
        self.assertEqual(
            [call["stage"] for call in transport.calls],
            [
                "coverage_v1.coverage",
                "coverage_v1.repair",
                "coverage_v1.fact_audit",
                "coverage_v1.fact_audit_details",
                "coverage_v1.fact_repair",
                "coverage_v1.fact_reaudit",
                "coverage_v1.fact_reaudit_details",
            ],
        )
        self.assertEqual(report["cost"]["call_count"], 7)
        ledger = report["fact_audit"]["sequence_ledger"]
        self.assertEqual(
            [row["page"] for row in ledger],
            sorted(row["page"] for row in ledger),
        )
        richie_row = next(
            row for row in ledger if row["action"].startswith("Richie receives")
        )
        self.assertEqual(richie_row["phase"], "climax")
        self.assertEqual(richie_row["phase_normalized_from"], "ending")
        self.assertEqual(richie_row["phase_input_order"], 2)
        markers = [row for row in ledger if row["action"] == "NOT PRESENT"]
        self.assertEqual(
            [row["page_normalized_from"] for row in markers],
            [0, 99],
        )
        self.assertTrue(
            report["fact_audit"]["sequence_normalization_diagnostics"]
        )

    def test_phase_page_sort_is_stable_and_preserves_input_order(self):
        coverage = valid_coverage()
        audit = provider_audit_core(coverage)
        first = audit["sequence_ledger"]["climax"][0]
        first["page"] = 5
        first["action"] = "Same-page beat A."
        earlier = copy.deepcopy(first)
        earlier["page"] = 3
        earlier["action"] = "Earlier beat."
        same_page = copy.deepcopy(first)
        same_page["action"] = "Same-page beat B."
        audit["sequence_ledger"]["climax"] = [first, earlier, same_page]
        audit["sequence_ledger"]["ending"][0]["page"] = 5
        final_late = audit["sequence_ledger"]["final_scene"][0]
        final_late["page"] = 6
        final_late["action"] = "Final-scene beat B."
        final_early = copy.deepcopy(final_late)
        final_early["page"] = 5
        final_early["action"] = "Final-scene beat A."
        audit["sequence_ledger"]["final_scene"] = [final_late, final_early]

        normalized = cv.normalize_audit_tool_input(audit, range(1, 7))

        self.assertNotIn("_sequence_normalization_errors", normalized)
        climax = [
            row for row in normalized["sequence_ledger"]
            if row["phase"] == "climax"
        ]
        self.assertEqual(
            [row["action"] for row in climax],
            ["Earlier beat.", "Same-page beat A.", "Same-page beat B."],
        )
        self.assertEqual(
            [row["phase_input_order"] for row in climax],
            [2, 1, 3],
        )
        final_scene = [
            row for row in normalized["sequence_ledger"]
            if row["phase"] == "final_scene"
        ]
        self.assertEqual(
            [row["action"] for row in final_scene],
            ["Final-scene beat A.", "Final-scene beat B."],
        )
        self.assertEqual(
            [row["phase_input_order"] for row in final_scene], [2, 1]
        )

    def test_post_climax_buckets_merge_and_absence_marker_lands_last(self):
        coverage = valid_coverage()
        audit = provider_audit_core(coverage)
        audit["sequence_ledger"]["climax"][0]["page"] = 4
        audit["sequence_ledger"]["ending"][0]["page"] = 5
        first_final = audit["sequence_ledger"]["final_scene"][0]
        first_final["page"] = 6
        first_final["action"] = "First beat on the final page."
        second_final = copy.deepcopy(first_final)
        second_final["action"] = "Second beat on the final page."
        audit["sequence_ledger"]["final_scene"].append(second_final)
        audit["sequence_ledger"]["tag"][0]["page"] = 1
        audit["sequence_ledger"]["aftermath"][0]["page"] = 5

        normalized = cv.normalize_audit_tool_input(audit, range(1, 7))

        self.assertNotIn("_sequence_normalization_errors", normalized)
        ledger = normalized["sequence_ledger"]
        self.assertEqual(
            [row["phase"] for row in ledger],
            [
                "climax", "ending", "aftermath",
                "final_scene", "final_scene", "tag",
            ],
        )
        self.assertEqual(
            [row["action"] for row in ledger[3:5]],
            ["First beat on the final page.", "Second beat on the final page."],
        )
        self.assertEqual(ledger[-1]["action"], "NOT PRESENT")
        self.assertEqual(ledger[-1]["page"], 6)
        self.assertEqual(ledger[-1]["page_normalized_from"], 1)

    def test_multiple_early_endings_reclassify_without_changing_content(self):
        coverage = valid_coverage()
        audit = provider_audit_core(coverage)
        first_climax = audit["sequence_ledger"]["climax"][0]
        first_climax["page"] = 3
        final_climax = copy.deepcopy(first_climax)
        final_climax["page"] = 6
        final_climax["action"] = "The decisive reversal completes."
        audit["sequence_ledger"]["climax"].append(final_climax)
        first_early = audit["sequence_ledger"]["ending"][0]
        first_early["page"] = 4
        first_early["action"] = "A false resolution begins."
        second_early = copy.deepcopy(first_early)
        second_early["page"] = 5
        second_early["action"] = "A subplot resolves before the reversal."
        actual_ending = copy.deepcopy(first_early)
        actual_ending["page"] = 6
        actual_ending["action"] = "The actual ending begins."
        audit["sequence_ledger"]["ending"] = [
            first_early, second_early, actual_ending,
        ]
        originals = copy.deepcopy(audit["sequence_ledger"]["ending"][:2])

        normalized = cv.normalize_audit_tool_input(audit, range(1, 7))

        self.assertNotIn("_sequence_normalization_errors", normalized)
        ledger = normalized["sequence_ledger"]
        reclassified = [
            row for row in ledger if row.get("phase_normalized_from") == "ending"
        ]
        self.assertEqual([row["page"] for row in reclassified], [4, 5])
        for original, row in zip(originals, reclassified):
            self.assertEqual(
                {key: value for key, value in row.items() if key not in {
                    "order", "phase", "phase_normalized_from",
                }},
                original,
            )
        page_six = [row["phase"] for row in ledger if row["page"] == 6]
        self.assertEqual(page_six[:2], ["climax", "ending"])

    def test_invalid_phase_boundaries_and_markers_fail_normalization(self):
        coverage = valid_coverage()
        cases = []

        early_final_scene = provider_audit_core(coverage)
        first_climax = early_final_scene["sequence_ledger"]["climax"][0]
        first_climax["page"] = 4
        final_climax = copy.deepcopy(first_climax)
        final_climax["page"] = 6
        early_final_scene["sequence_ledger"]["climax"].append(final_climax)
        early_final_scene["sequence_ledger"]["final_scene"][0]["page"] = 5
        cases.append((
            early_final_scene,
            "final_scene begins before the final climax",
        ))

        no_post_climax_ending = provider_audit_core(coverage)
        first_climax = no_post_climax_ending["sequence_ledger"]["climax"][0]
        first_climax["page"] = 4
        final_climax = copy.deepcopy(first_climax)
        final_climax["page"] = 6
        no_post_climax_ending["sequence_ledger"]["climax"].append(
            final_climax
        )
        no_post_climax_ending["sequence_ledger"]["ending"][0]["page"] = 5
        cases.append((
            no_post_climax_ending,
            "ending begins before the final climax",
        ))

        pre_climax_ending = provider_audit_core(coverage)
        first_climax = pre_climax_ending["sequence_ledger"]["climax"][0]
        first_climax["page"] = 4
        final_climax = copy.deepcopy(first_climax)
        final_climax["page"] = 6
        pre_climax_ending["sequence_ledger"]["climax"].append(final_climax)
        early = pre_climax_ending["sequence_ledger"]["ending"][0]
        early["page"] = 3
        actual = copy.deepcopy(early)
        actual["page"] = 6
        pre_climax_ending["sequence_ledger"]["ending"].append(actual)
        cases.append((
            pre_climax_ending,
            "ending begins before the final climax",
        ))

        early_tag = provider_audit_core(coverage)
        first_climax = early_tag["sequence_ledger"]["climax"][0]
        first_climax["page"] = 4
        final_climax = copy.deepcopy(first_climax)
        final_climax["page"] = 6
        early_tag["sequence_ledger"]["climax"].append(final_climax)
        early_tag["sequence_ledger"]["tag"][0]["page"] = 5
        early_tag["sequence_ledger"]["tag"][0]["action"] = (
            "A material tag occurs."
        )
        cases.append((early_tag, "tag begins before the final climax"))

        early_aftermath = provider_audit_core(coverage)
        first_climax = early_aftermath["sequence_ledger"]["climax"][0]
        first_climax["page"] = 4
        final_climax = copy.deepcopy(first_climax)
        final_climax["page"] = 6
        early_aftermath["sequence_ledger"]["climax"].append(final_climax)
        early_aftermath["sequence_ledger"]["aftermath"][0]["page"] = 5
        cases.append((
            early_aftermath,
            "aftermath begins before the final climax",
        ))

        mixed_tag = provider_audit_core(coverage)
        extra_tag = copy.deepcopy(mixed_tag["sequence_ledger"]["tag"][0])
        extra_tag["action"] = "A real tag beat."
        mixed_tag["sequence_ledger"]["tag"].append(extra_tag)
        cases.append((mixed_tag, "tag has an invalid NOT PRESENT marker"))

        duplicate_marker = provider_audit_core(coverage)
        duplicate_marker["sequence_ledger"]["tag"].append(copy.deepcopy(
            duplicate_marker["sequence_ledger"]["tag"][0]
        ))
        cases.append((
            duplicate_marker,
            "tag has an invalid NOT PRESENT marker",
        ))

        sentinel_ending = provider_audit_core(coverage)
        sentinel_ending["sequence_ledger"]["ending"][0]["action"] = (
            "NOT PRESENT"
        )
        cases.append((sentinel_ending, "ending has an invalid NOT PRESENT marker"))

        noninteger = provider_audit_core(coverage)
        noninteger["sequence_ledger"]["climax"][0]["page"] = "6"
        cases.append((noninteger, "climax page is invalid"))

        impossible = provider_audit_core(coverage)
        impossible["sequence_ledger"]["climax"][0]["page"] = 99
        cases.append((impossible, "climax page is invalid"))

        impossible_aftermath = provider_audit_core(coverage)
        impossible_aftermath["sequence_ledger"]["aftermath"][0]["page"] = 99
        cases.append((impossible_aftermath, "aftermath page is invalid"))

        noninteger_marker = provider_audit_core(coverage)
        noninteger_marker["sequence_ledger"]["tag"][0]["page"] = "N/A"
        cases.append((noninteger_marker, "tag page is invalid"))

        near_marker = provider_audit_core(coverage)
        near_marker["sequence_ledger"]["tag"][0]["action"] = " NOT PRESENT "
        cases.append((near_marker, "tag has an invalid NOT PRESENT marker"))

        no_material = provider_audit_core(coverage)
        for phase in ("climax", "ending", "final_scene"):
            no_material["sequence_ledger"][phase] = []
        for phase in ("tag", "aftermath"):
            for field in cv.GROUNDED_SEQUENCE_FIELDS:
                no_material["sequence_ledger"][phase][0][field] = (
                    "NOT PRESENT"
                )
        cases.append((no_material, "contains no material story beats"))

        for payload, expected in cases:
            with self.subTest(expected=expected):
                normalized = cv.normalize_audit_tool_input(payload, range(1, 7))
                self.assertTrue(
                    any(
                        expected in error
                        for error in normalized[
                            "_sequence_normalization_errors"
                        ]
                    )
                )

    def test_mixed_absence_marker_is_not_hidden_from_grounding(self):
        coverage = valid_coverage()
        audit = provider_audit_core(coverage)
        marker = audit["sequence_ledger"]["tag"][0]
        marker.update({
            "actor": "Carlos",
            "result": "Carlos wins the contest.",
            "character_knowledge": "Carlos",
            "audience_knowledge": "The audience sees Carlos win.",
        })

        normalized = cv.normalize_audit_tool_input(audit, range(1, 7))
        rows = cv.build_detail_audit_rows(
            coverage, [], normalized["sequence_ledger"]
        )

        self.assertIn(
            "sequence_ledger tag has an invalid NOT PRESENT marker",
            normalized["_sequence_normalization_errors"],
        )
        self.assertTrue(any(
            row.get("kind") == "sequence_evidence"
            and row.get("subject", {}).get("beat", {}).get("actor") == "Carlos"
            for row in rows
        ))

        flattened = supported_audit(coverage)
        flat_marker = next(
            beat for beat in flattened["sequence_ledger"]
            if beat["phase"] == "tag"
        )
        flat_marker.update(marker)
        problems = cv.validate_audit_payload(
            flattened,
            cv.build_audit_claims(coverage),
            coverage,
            cv.build_page_reference_map(SCREENPLAY_TEXT, 6, None),
            cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT),
        )
        self.assertIn(
            f"sequence_ledger[{flat_marker['order'] - 1}] has an invalid "
            "NOT PRESENT marker",
            problems,
        )

    def test_continuity_flags_are_validated_and_preserved(self):
        coverage = valid_coverage()
        coverage["continuity_flags"] = [
            'p.1 la madre se llama "Esperanza Blanco" pero p.2 la narración '
            'dice "Rosa también murió" — misma mujer, dos nombres',
        ]
        self.assertEqual(cv.validate_coverage_payload(coverage, FEATURE_STACK), [])
        broken = valid_coverage()
        broken["continuity_flags"] = "ninguna"
        self.assertTrue(
            any(
                "continuity_flags" in problem
                for problem in cv.validate_coverage_payload(broken, FEATURE_STACK)
            )
        )

    def test_citation_excerpt_contract_rejects_under_and_over_length(self):
        coverage = valid_coverage()
        coverage["lens_notes"][0]["excerpt"] = "dos palabras"
        coverage["strengths"][0]["excerpt"] = (
            "uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece"
        )

        problems = cv.validate_coverage_payload(coverage, FEATURE_STACK)

        self.assertTrue(
            any("lens_notes[0].excerpt must contain 3-12" in p for p in problems)
        )
        self.assertTrue(
            any("strengths[0].excerpt must contain 3-12" in p for p in problems)
        )

    def test_cost_split_keeps_uncertain_separate(self):
        coverage = valid_coverage()
        transport = FakeTransport(
            [
                (coverage, settled_usage(200_000)),
                (supported_audit(coverage), uncertain_usage(90_000)),
            ]
        )
        report, _usage = run_engine(new_store(), transport)
        cost = report["cost"]
        self.assertAlmostEqual(cost["charged_usd"], 0.29)
        self.assertAlmostEqual(cost["settled_usd"], 0.20)
        self.assertAlmostEqual(cost["uncertain_usd"], 0.09)


class TestVerdictRules(unittest.TestCase):
    def test_film_now_becomes_nomination_on_recommend(self):
        coverage = valid_coverage()
        coverage["verdict"] = "FILM_NOW"
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (supported_audit(coverage), settled_usage()),
            ]
        )
        report, _usage = run_engine(new_store(), transport)
        self.assertEqual(report["verdict"], "RECOMMEND")
        self.assertTrue(report["film_now_nominated"])
        self.assertTrue(any("FILM_NOW" in a for a in report["verdict_adjustments"]))

    def test_failed_genre_contract_caps_recommend_at_consider(self):
        coverage = valid_coverage()
        coverage["verdict"] = "RECOMMEND"
        coverage["genre_contract"]["met"] = False
        coverage["genre_contract"]["failures"] = [
            "La comedia no aterriza risas en la página en todo el segundo acto"
        ]
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (supported_audit(coverage), settled_usage()),
            ]
        )
        report, _usage = run_engine(new_store(), transport)
        self.assertEqual(report["verdict"], "CONSIDER")
        self.assertTrue(any("genre contract" in a for a in report["verdict_adjustments"]))

    def test_low_confidence_requests_human_review_without_extra_calls(self):
        coverage = valid_coverage()
        coverage["confidence"] = "low"
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (supported_audit(coverage), settled_usage()),
            ]
        )
        report, _usage = run_engine(new_store(), transport)
        self.assertEqual(len(transport.calls), 2)
        self.assertEqual(report["status"], "sealed")
        self.assertTrue(report["human_review_recommended"])
        self.assertIn("reader confidence is low", report["review_reasons"])

    def test_unresolved_reliability_caps_high_confidence_at_medium(self):
        coverage = valid_coverage()
        audit = supported_audit(coverage)
        for row in audit["verdicts"]:
            if row["claim_id"] == "guard.page_reference_integrity":
                row["classification"] = "contradicted"
                row["note"] = "A central page claim remains unresolved."
        # A malformed infrastructure guard is not safe to repair from prose.
        audit["existing_evidence_verdicts"][0] = {
            "field_path": audit["existing_evidence_verdicts"][0]["field_path"],
            "classification": "unsupported",
            "note": "COUNT_LEDGER_INVALID: source evidence is incomplete",
            "count_ledger": {"valid": False, "reason": "incomplete"},
        }
        for row in audit["verdicts"]:
            if row["claim_id"] == "guard.existing_evidence":
                row["classification"] = "unsupported"
        transport = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (coverage, settled_usage()),
        ])

        report, _usage = run_engine(new_store(), transport)

        self.assertEqual(report["status"], "needs_review")
        self.assertEqual(report["confidence"], "medium")
        self.assertEqual(report["coverage"]["confidence"], "medium")
        self.assertTrue(report["confidence_adjustments"])

    def test_unlocated_sequence_knowledge_cannot_seal_high_confidence(self):
        coverage = valid_coverage()
        complete_audit = supported_audit(coverage)
        for beat in complete_audit["sequence_ledger"]:
            if beat["action"] != "NOT PRESENT":
                beat["character_knowledge"] = "NOT LOCATED"
        provider_audit = provider_audit_core(coverage)
        for beats in provider_audit["sequence_ledger"].values():
            for beat in beats:
                if beat["action"] != "NOT PRESENT":
                    beat["character_knowledge"] = "NOT LOCATED"
        transport = FakeTransport([
            (coverage, settled_usage()),
            (provider_audit, settled_usage()),
            (
                supported_detail_payload(coverage, complete_audit),
                settled_usage(),
            ),
        ])

        report, _usage = run_engine(new_store(), transport)

        self.assertEqual(report["status"], "needs_review")
        self.assertEqual(report["confidence"], "medium")
        self.assertTrue(report["human_review_recommended"])
        self.assertTrue(any(
            "character knowledge was not located" in reason
            for reason in report["review_reasons"]
        ))
        self.assertTrue(report["confidence_adjustments"])


class TestRepairBudget(unittest.TestCase):
    def test_invalid_coverage_gets_exactly_one_repair(self):
        broken = valid_coverage()
        del broken["development_priorities"]
        fixed = valid_coverage()
        transport = FakeTransport(
            [
                (broken, settled_usage()),
                (fixed, settled_usage(40_000)),
                (supported_audit(fixed), settled_usage()),
            ]
        )
        report, usage = run_engine(new_store(), transport)
        self.assertEqual(len(transport.calls), 3)
        self.assertEqual(report["status"], "sealed")
        self.assertEqual(report["cost"]["repair_calls_used"], 1)
        # The repair call must not resend the screenplay.
        repair_call = transport.calls[1]
        self.assertEqual(repair_call["stage"], "coverage_v1.repair")
        repair_text = json.dumps(repair_call["user_blocks"])
        self.assertNotIn("SCREENPLAY TEXT", repair_text)

    def test_still_invalid_after_repair_fails_closed(self):
        broken = valid_coverage()
        del broken["development_priorities"]
        transport = FakeTransport(
            [
                (broken, settled_usage()),
                (broken, settled_usage()),
            ]
        )
        store = new_store()
        with self.assertRaises(cv.CoverageContractError):
            run_engine(store, transport)
        self.assertEqual(len(transport.calls), 2)
        # Nothing invalid was checkpointed.
        binding_key_probe = transport.calls[0]
        self.assertIsNotNone(binding_key_probe)

    def test_coverage_repair_does_not_consume_the_audit_retry(self):
        broken = valid_coverage()
        del broken["development_priorities"]
        fixed = valid_coverage()
        bad_audit = provider_audit_core(fixed)
        bad_audit["sequence_ledger"]["final_scene"][0]["page"] = 5
        bad_audit["sequence_ledger"]["climax"][0]["page"] = 6
        transport = FakeTransport([
            (broken, settled_usage()),
            (fixed, settled_usage()),
            (bad_audit, settled_usage()),
            (provider_audit_core(fixed), settled_usage()),
            (supported_detail_payload(fixed), settled_usage()),
        ])

        report, _usage = run_engine(new_store(), transport)

        self.assertEqual(report["status"], "sealed")
        self.assertEqual(len(transport.calls), 5)
        self.assertEqual(report["cost"]["repair_calls_used"], 2)
        self.assertEqual(report["cost"]["coverage_repair_calls_used"], 1)
        self.assertEqual(report["cost"]["audit_retry_calls_used"], 1)

    def test_unverified_citation_uses_one_source_grounded_repair(self):
        broken = valid_coverage()
        broken["strengths"][0]["excerpt"] = (
            "detiene el penal con una sola mano falsa"
        )
        fixed = valid_coverage()
        transport = FakeTransport(
            [
                (broken, settled_usage()),
                (fixed, settled_usage(40_000)),
                (supported_audit(fixed), settled_usage()),
            ]
        )

        report, usage = run_engine(new_store(), transport)

        self.assertEqual(len(transport.calls), 3)
        self.assertEqual(report["status"], "sealed")
        self.assertEqual(report["citation_verification"]["unverified"], 0)
        self.assertEqual(report["cost"]["repair_calls_used"], 1)
        self.assertEqual(usage["call_count"], 3)
        repair_call = transport.calls[1]
        self.assertEqual(repair_call["stage"], "coverage_v1.repair")
        repair_text = "\n".join(
            str(block.get("text", ""))
            for block in repair_call["user_blocks"]
        )
        self.assertIn("# CITED SOURCE PAGES", repair_text)
        self.assertIn("detiene el penal con una sola mano", repair_text)
        self.assertNotIn("# SCREENPLAY TEXT", repair_text)
        self.assertTrue(
            any(
                "strengths[0].excerpt is not verbatim on cited page 2" in problem
                for problem in report["diagnostics"][
                    "coverage_first_pass_problems"
                ]
            )
        )


class TestCheckpointsAndResume(unittest.TestCase):
    def test_detail_16_migration_strips_false_source_anchors_idempotently(self):
        source = (
            "[PAGE 1]\nDiego waits by the gate.\n"
            "Carlos opens the vault door.\n"
        )
        row = {
            "slot": "row_001",
            "kind": "sequence_evidence",
            "identifier": "sequence_ledger[0]",
            "subject": {
                "beat": {
                    "order": 1,
                    "phase": "climax",
                    "page": 1,
                    "actor": "Diego",
                    "action": "Diego opens the vault door.",
                    "result": "NOT LOCATED",
                    "character_knowledge": "NOT LOCATED",
                    "audience_knowledge": "NOT LOCATED",
                },
                "required_fields": ["actor", "action"],
                "claim_sha256": "a" * 64,
            },
        }
        anchors = cv._source_anchor_catalog(source)

        def check(field: str, fragment: str, supports: bool) -> dict:
            anchor_id, anchor = next(
                (key, value) for key, value in anchors.items()
                if fragment in value["excerpt"]
            )
            return {
                "field": field,
                "page": anchor["page"],
                "excerpt": anchor["excerpt"],
                "supports": supports,
                "source_anchor_id": anchor_id,
            }

        progress = {
            "detail_contract_version": cv.LEGACY_FIELD_SOURCE_PROGRESS_VERSION,
            "evidence_rows": [{
                "field_path": row["identifier"],
                "classification": "partially_supported",
                "note": "Only the actor field is supported.",
                "checks": [
                    check("actor", "Diego waits", True),
                    check("action", "Carlos opens", False),
                ],
                "claim_sha256": row["subject"]["claim_sha256"],
                "grounding_valid": True,
            }],
            "citation_rows": [],
        }

        accepted, citations, pending, feedback = (
            cv._migrate_source_anchor_progress(
                progress, [row], [row], source
            )
        )

        self.assertEqual(citations, [])
        self.assertEqual(pending, [])
        self.assertEqual(feedback, {})
        migrated_action = next(
            item for item in accepted[0]["checks"]
            if item["field"] == "action"
        )
        self.assertEqual(
            migrated_action, {"field": "action", "supports": False}
        )
        migrated_again = cv._migrate_source_anchor_progress(
            {"evidence_rows": accepted, "citation_rows": []},
            [row],
            [row],
            source,
        )[0]
        self.assertEqual(migrated_again, accepted)

    def test_audit_failure_preserves_coverage_and_resume_repays_nothing(self):
        coverage = valid_coverage()
        first = FakeTransport(
            [
                (coverage, settled_usage(200_000)),
                RuntimeError("proxy died mid-audit"),
            ]
        )
        store = new_store()
        with self.assertRaises(RuntimeError):
            run_engine(store, first)
        self.assertEqual(len(first.calls), 2)

        second = FakeTransport(
            [
                (supported_audit(coverage), settled_usage(80_000)),
            ]
        )
        report, usage = run_engine(store, second)
        self.assertEqual(len(second.calls), 1)
        self.assertEqual(second.calls[0]["stage"], "coverage_v1.fact_audit")
        self.assertTrue(report["replay"]["coverage_replayed"])
        self.assertFalse(report["replay"]["audit_replayed"])
        self.assertEqual(report["status"], "sealed")
        # The resumed run's usage carries only the audit call.
        self.assertEqual(usage["call_count"], 1)

    def test_migrated_coverage_reports_its_original_prompt_provenance(self):
        coverage = valid_coverage()
        store = new_store()
        with self.assertRaises(RuntimeError):
            run_engine(
                store,
                FakeTransport([
                    (coverage, settled_usage()),
                    RuntimeError("audit stopped before dispatch"),
                ]),
            )
        [target] = list(store.root.glob("*/coverage.json"))
        record = json.loads(target.read_text(encoding="utf-8"))
        record["payload"]["migration"] = {
            "kind": "legacy_coverage_checkpoint_reseal",
            "source_prompt_sha256": "b" * 64,
        }
        record["payload_sha256"] = cv.canonical_json_hash(record["payload"])
        target.write_text(json.dumps(record), encoding="utf-8")

        report, _usage = run_engine(
            store,
            FakeTransport([(supported_audit(coverage), settled_usage())]),
        )

        self.assertEqual(report["coverage_source_prompt_sha256"], "b" * 64)
        self.assertEqual(
            report["replay"]["coverage_checkpoint_migration"]["kind"],
            "legacy_coverage_checkpoint_reseal",
        )

    def test_detail_failure_replays_coverage_and_audit_core_for_free(self):
        coverage = valid_coverage()
        store = new_store()
        first = FakeTransport(
            [
                (coverage, settled_usage(200_000)),
                (provider_audit_core(coverage), settled_usage(80_000)),
                RuntimeError("proxy died mid-detail-audit"),
            ]
        )

        with self.assertRaises(RuntimeError):
            run_engine(store, first)

        self.assertEqual(len(first.calls), 3)
        resume = FakeTransport(
            [(supported_detail_payload(coverage), settled_usage(40_000))]
        )
        report, usage = run_engine(store, resume)
        self.assertEqual(len(resume.calls), 1)
        self.assertEqual(
            resume.calls[0]["stage"], "coverage_v1.fact_audit_details"
        )
        self.assertTrue(report["replay"]["coverage_replayed"])
        self.assertTrue(report["replay"]["audit_core_replayed"])
        self.assertFalse(report["replay"]["audit_replayed"])
        self.assertEqual(report["status"], "sealed")
        self.assertEqual(usage["call_count"], 1)

    def test_legacy_detail_12_progress_resumes_with_typed_a_and_b_only(self):
        coverage = valid_coverage()
        audit = provider_audit_core(coverage)
        source = SCREENPLAY_TEXT
        normalized = cv.normalize_audit_tool_input(
            copy.deepcopy(audit), range(1, 7)
        )
        rows = cv.build_detail_audit_rows(
            coverage,
            cv.build_existing_evidence_checks(coverage, source),
            normalized["sequence_ledger"],
        )
        text_row = next(
            row for row in rows if row["kind"] == "existing_evidence"
        )
        citation_row = next(
            row for row in rows if row["kind"] == "citation_relevance"
        )
        grounded_rows = [
            row for row in rows
            if row["kind"] in {"citation_relevance", "sequence_evidence"}
        ]
        malformed = supported_detail_payload(coverage, normalized, source)
        malformed["results"][text_row["slot"]] = "supported"
        malformed["results"][citation_row["slot"]] = "supported"
        store = new_store()
        first = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (malformed, settled_usage()),
            RuntimeError("stop before typed recovery A"),
        ])

        with self.assertRaises(RuntimeError):
            run_engine(store, first, text=source)

        [core_path] = list(store.root.glob("*/audit_core.json"))
        core = json.loads(core_path.read_text(encoding="utf-8"))
        core["payload"].pop("audit_core_contract_version")
        core["payload"]["detail_contract_version"] = (
            cv.LEGACY_AUDIT_CORE_VERSION
        )
        core["payload_sha256"] = cv.canonical_json_hash(core["payload"])
        core_path.write_text(json.dumps(core), encoding="utf-8")
        [progress_path] = list(store.root.glob("*/audit_details_progress.json"))
        progress = json.loads(progress_path.read_text(encoding="utf-8"))
        progress["payload"]["detail_contract_version"] = (
            cv.LEGACY_DETAIL_PROGRESS_VERSION
        )
        for field in (
            "typed_a_plan", "typed_b_plan",
            "completed_typed_a_batches", "completed_typed_b_batches",
        ):
            progress["payload"].pop(field, None)
        progress["payload_sha256"] = cv.canonical_json_hash(
            progress["payload"]
        )
        progress_path.write_text(json.dumps(progress), encoding="utf-8")

        resume = FakeTransport([
            (typed_detail_payload_for_rows([text_row], source), settled_usage()),
            (typed_detail_payload_for_rows(grounded_rows, source), settled_usage()),
        ])
        report, usage = run_engine(store, resume, text=source)

        self.assertEqual(
            [call["stage"] for call in resume.calls],
            [
                "coverage_v1.fact_audit_details_typed_a",
                "coverage_v1.fact_audit_details_typed_b",
            ],
        )
        self.assertTrue(report["replay"]["audit_core_replayed"])
        self.assertEqual(report["status"], "sealed")
        self.assertEqual(usage["call_count"], 2)

    def test_legacy_detail_13_count_is_revalidated_before_resume(self):
        coverage = valid_coverage()
        coverage["story_spine"]["opposition"] = "Five members arrive."
        source = SCREENPLAY_TEXT.replace(
            "[PAGE 1]", "[PAGE 1]\nLlega Lucesita"
        )
        audit = provider_audit_core(coverage)
        normalized = cv.normalize_audit_tool_input(
            copy.deepcopy(audit), range(1, 7)
        )
        rows = cv.build_detail_audit_rows(
            coverage,
            cv.build_existing_evidence_checks(coverage, source),
            normalized["sequence_ledger"],
        )
        count_row = next(
            row for row in rows
            if row.get("subject", {}).get("trigger") == "counting_claim"
        )
        store = new_store()
        first = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (supported_detail_payload(coverage, normalized, source), settled_usage()),
            RuntimeError("stop before typed recovery A"),
        ])

        with self.assertRaises(RuntimeError):
            run_engine(store, first, text=source)

        [progress_path] = list(
            store.root.glob("*/audit_details_progress.json")
        )
        record = json.loads(progress_path.read_text(encoding="utf-8"))
        payload = record["payload"]
        payload["detail_contract_version"] = cv.LEGACY_DETAIL_PROGRESS_VERSION
        payload["text_retry_plan"] = []
        payload["typed_a_plan"] = []
        payload["completed_typed_a_batches"] = []
        payload["count_retry_feedback"] = {}
        payload["evidence_rows"] = [
            row for row in payload["evidence_rows"]
            if row.get("field_path") != count_row["identifier"]
        ]
        payload["evidence_rows"].append({
            "field_path": count_row["identifier"],
            "classification": "supported",
            "note": "Five members are represented by this one anchor.",
            "count_ledger": {
                "valid": True,
                "claimed_total": 5,
                "claimed_max_total": None,
                "observed_total": 5,
                "count_quantifier": "exact",
                "claimed_universe_total": None,
                "observed_universe_total": 5,
                "instances": [{
                    "label": "Lucesita",
                    "page": 1,
                    "excerpt": "Llega Lucesita",
                    "matches_claim": True,
                    "multiplicity": 5,
                }],
            },
        })
        progress_path.write_text(
            json.dumps(cv._sealed_record(record["binding"], payload)),
            encoding="utf-8",
        )

        resume = FakeTransport([
            RuntimeError("stop after legacy count revalidation"),
        ])
        with self.assertRaises(RuntimeError):
            run_engine(store, resume, text=source)

        self.assertEqual(len(resume.calls), 1)
        self.assertEqual(
            resume.calls[0]["stage"],
            "coverage_v1.fact_audit_details_typed_b",
        )
        count_schema = resume.calls[0]["tool"]["input_schema"]["properties"][
            "count_results"
        ]
        self.assertEqual(
            count_schema["items"]["properties"]["slot"]["enum"],
            [count_row["slot"]],
        )

    def test_detail_14_migration_removes_subjective_count_without_rebuy(self):
        class FailAuditSave(cv.LocalCheckpointStore):
            def save(self, key, stage, record):
                if stage == "audit":
                    raise RuntimeError("stop before final audit checkpoint")
                super().save(key, stage, record)

        coverage = valid_coverage()
        coverage["concerns"][0]["point"] = (
            "Preserve the two or three genuinely earned resolutions before "
            "the parody escalation."
        )
        audit = provider_audit_core(coverage)
        normalized = cv.normalize_audit_tool_input(
            copy.deepcopy(audit), range(1, 7)
        )
        current_rows = cv.build_detail_audit_rows(
            coverage,
            cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT),
            normalized["sequence_ledger"],
        )
        prior_rows = cv.build_detail_audit_rows(
            coverage,
            cv.build_existing_evidence_checks(
                coverage,
                SCREENPLAY_TEXT,
                include_subjective_counts=True,
            ),
            normalized["sequence_ledger"],
        )
        self.assertEqual(len(prior_rows), len(current_rows) + 1)
        self.assertTrue(any(
            row.get("subject", {}).get("trigger") == "counting_claim"
            and "genuinely earned" in row["subject"]["claim"]
            for row in prior_rows
        ))
        root = Path(tempfile.mkdtemp()) / "cv1"
        first_store = FailAuditSave(root)
        with self.assertRaisesRegex(
            RuntimeError, "stop before final audit checkpoint"
        ):
            run_engine(
                first_store,
                FakeTransport([
                    (coverage, settled_usage()),
                    (audit, settled_usage()),
                    (
                        typed_detail_payload_for_rows(current_rows),
                        settled_usage(),
                    ),
                ]),
            )

        progress_path = next(root.glob("*/audit_details_progress.json"))
        record = json.loads(progress_path.read_text(encoding="utf-8"))
        record["payload"]["detail_contract_version"] = (
            cv.SOURCE_ANCHOR_MIGRATION_VERSION
        )
        record["payload"]["rows_sha256"] = cv.canonical_json_hash(prior_rows)
        progress_path.write_text(
            json.dumps(cv._sealed_record(record["binding"], record["payload"])),
            encoding="utf-8",
        )

        resume = FakeTransport([RuntimeError("stop after detail migration")])
        report, _usage = run_engine(cv.LocalCheckpointStore(root), resume)

        self.assertEqual(resume.calls, [])
        self.assertEqual(report["status"], "sealed")
        migrated = json.loads(progress_path.read_text(encoding="utf-8"))[
            "payload"
        ]
        self.assertEqual(
            migrated["detail_contract_version"],
            cv.DETAIL_AUDIT_CONTRACT_VERSION,
        )
        self.assertEqual(migrated["typed_b_plan"], [])

    def test_legacy_detail_13_preserves_completed_25_slot_typed_a(self):
        coverage = valid_coverage()
        coverage["synopsis"] = " ".join(
            f"Two events occur in sequence {index}."
            for index in range(19)
        )
        audit = provider_audit_core(coverage)
        normalized = cv.normalize_audit_tool_input(
            copy.deepcopy(audit), range(1, 7)
        )
        rows = cv.build_detail_audit_rows(
            coverage,
            cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT),
            normalized["sequence_ledger"],
        )
        typed_a_rows = [
            row for row in rows if row["kind"] == "existing_evidence"
        ]
        self.assertEqual(len(typed_a_rows), 25)
        main_detail = {
            "results": {row["slot"]: "supported" for row in rows}
        }
        typed_a = typed_detail_payload_for_rows(typed_a_rows)
        malformed_slots = {
            row["slot"] for row in typed_a_rows[:4]
        }
        for values in typed_a.values():
            for value in values:
                if value["slot"] in malformed_slots:
                    value.pop("note" if "note" in value else "instances")
        store = new_store()
        first = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (main_detail, settled_usage()),
            (typed_a, settled_usage()),
            RuntimeError("stop before typed recovery B"),
        ])

        with self.assertRaises(RuntimeError):
            run_engine(store, first)

        [progress_path] = list(
            store.root.glob("*/audit_details_progress.json")
        )
        record = json.loads(progress_path.read_text(encoding="utf-8"))
        payload = record["payload"]
        self.assertEqual(len(payload["typed_a_plan"]), 25)
        self.assertEqual(len(payload["evidence_rows"]), 21)
        self.assertEqual(len(payload["completed_typed_a_batches"]), 1)
        payload["detail_contract_version"] = cv.LEGACY_DETAIL_PROGRESS_VERSION
        progress_path.write_text(
            json.dumps(cv._sealed_record(record["binding"], payload)),
            encoding="utf-8",
        )

        resume = FakeTransport([
            RuntimeError("stop after migrated typed recovery B"),
        ])
        with self.assertRaises(RuntimeError):
            run_engine(store, resume)

        self.assertEqual(len(resume.calls), 1)
        self.assertEqual(
            resume.calls[0]["stage"],
            "coverage_v1.fact_audit_details_typed_b",
        )
        migrated = json.loads(
            progress_path.read_text(encoding="utf-8")
        )["payload"]
        self.assertEqual(
            migrated["detail_contract_version"],
            cv.DETAIL_AUDIT_CONTRACT_VERSION,
        )
        self.assertEqual(len(migrated["completed_typed_a_batches"]), 1)
        self.assertEqual(len(migrated["evidence_rows"]), 21)

    def test_legacy_detail_13_requeues_actor_only_knowledge_evidence(self):
        class FailAuditSave(cv.LocalCheckpointStore):
            def save(self, key, stage, record):
                if stage == "audit":
                    raise RuntimeError("stop before final audit checkpoint")
                super().save(key, stage, record)

        coverage = valid_coverage()
        audit = provider_audit_core(coverage)
        normalized = cv.normalize_audit_tool_input(
            copy.deepcopy(audit), range(1, 7)
        )
        rows = cv.build_detail_audit_rows(
            coverage,
            cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT),
            normalized["sequence_ledger"],
        )
        target = next(
            row for row in rows
            if row["kind"] == "sequence_evidence"
            and "character_knowledge"
            in row["subject"]["required_fields"]
        )
        store = FailAuditSave(Path(tempfile.mkdtemp()) / "cv1")
        first = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (supported_detail_payload(coverage, normalized), settled_usage()),
        ])

        with self.assertRaisesRegex(
            RuntimeError, "stop before final audit checkpoint"
        ):
            run_engine(store, first)

        [progress_path] = list(
            store.root.glob("*/audit_details_progress.json")
        )
        record = json.loads(progress_path.read_text(encoding="utf-8"))
        carried = next(
            row for row in record["payload"]["evidence_rows"]
            if row.get("field_path") == target["identifier"]
        )
        knowledge_check = next(
            check for check in carried["checks"]
            if check["field"] == "character_knowledge"
        )
        knowledge_check.clear()
        knowledge_check.update({
            "field": "character_knowledge",
            "page": 6,
            "excerpt": "Diego sobrevive y se queda como entrenador",
            "supports": True,
        })
        self.assertIsNone(
            cv._SEQUENCE_EXPLICIT_KNOWLEDGE_VERB.search(
                knowledge_check["excerpt"]
            )
        )
        record["payload"]["detail_contract_version"] = (
            cv.LEGACY_DETAIL_PROGRESS_VERSION
        )
        progress_path.write_text(
            json.dumps(
                cv._sealed_record(record["binding"], record["payload"])
            ),
            encoding="utf-8",
        )

        resume = FakeTransport([
            RuntimeError("stop after legacy grounded requeue"),
        ])
        with self.assertRaisesRegex(
            RuntimeError, "stop after legacy grounded requeue"
        ):
            run_engine(store, resume)

        self.assertEqual(len(resume.calls), 1)
        self.assertEqual(
            resume.calls[0]["stage"],
            "coverage_v1.fact_audit_details_typed_b",
        )
        sequence_schema = resume.calls[0]["tool"]["input_schema"][
            "properties"
        ][cv._detail_result_group(target)]
        self.assertIn(
            target["slot"],
            sequence_schema["items"]["properties"]["slot"]["enum"],
        )
        migrated = json.loads(
            progress_path.read_text(encoding="utf-8")
        )["payload"]
        self.assertNotIn(
            target["identifier"],
            {
                row.get("field_path")
                for row in migrated["evidence_rows"]
            },
        )

    def test_legacy_detail_audit_is_discarded_without_rebuying_core(self):
        coverage = valid_coverage()
        store = new_store()
        run_engine(
            store,
            FakeTransport(
                [
                    (coverage, settled_usage()),
                    (provider_audit_core(coverage), settled_usage()),
                    (supported_detail_payload(coverage), settled_usage()),
                ]
            ),
        )
        [target] = list(store.root.glob("*/audit.json"))
        record = json.loads(target.read_text(encoding="utf-8"))
        record["payload"].pop("detail_contract_version")
        record["payload_sha256"] = cv.canonical_json_hash(record["payload"])
        target.write_text(json.dumps(record), encoding="utf-8")

        resume = FakeTransport([])
        report, usage = run_engine(store, resume)

        self.assertEqual(len(resume.calls), 0)
        self.assertTrue(report["replay"]["coverage_replayed"])
        self.assertTrue(report["replay"]["audit_core_replayed"])
        self.assertFalse(report["replay"]["audit_replayed"])
        self.assertEqual(usage["call_count"], 0)
        self.assertEqual(report["status"], "sealed")

    def test_legacy_audit_core_is_discarded_before_detail_resume(self):
        coverage = valid_coverage()
        store = new_store()
        first = FakeTransport(
            [
                (coverage, settled_usage()),
                (provider_audit_core(coverage), settled_usage()),
                RuntimeError("proxy died mid-detail-audit"),
            ]
        )

        with self.assertRaises(RuntimeError):
            run_engine(store, first)

        [target] = list(store.root.glob("*/audit_core.json"))
        record = json.loads(target.read_text(encoding="utf-8"))
        record["payload"].pop("audit_core_contract_version")
        stale_climax = record["payload"]["tool_input"]["sequence_ledger"][
            0
        ]
        stale_climax["page"] = 6
        stale_climax["action"] = "The decisive action begins on p.5."
        record["payload_sha256"] = cv.canonical_json_hash(record["payload"])
        target.write_text(json.dumps(record), encoding="utf-8")
        for receipt in store.root.glob("*/call_receipts.json"):
            receipt.unlink()

        resume = FakeTransport(
            [
                (provider_audit_core(coverage), settled_usage()),
                (supported_detail_payload(coverage), settled_usage()),
            ]
        )
        report, usage = run_engine(store, resume)

        self.assertEqual(
            [call["stage"] for call in resume.calls],
            ["coverage_v1.fact_audit", "coverage_v1.fact_audit_details"],
        )
        self.assertTrue(report["replay"]["coverage_replayed"])
        self.assertFalse(report["replay"]["audit_core_replayed"])
        self.assertEqual(usage["call_count"], 2)
        self.assertEqual(report["status"], "sealed")

    def test_full_replay_makes_zero_calls(self):
        coverage = valid_coverage()
        store = new_store()
        run_engine(
            store,
            FakeTransport(
                [
                    (coverage, settled_usage()),
                    (supported_audit(coverage), settled_usage()),
                ]
            ),
        )
        replay = FakeTransport([])
        report, usage = run_engine(store, replay)
        self.assertEqual(len(replay.calls), 0)
        self.assertEqual(usage["call_count"], 0)
        self.assertTrue(report["replay"]["coverage_replayed"])
        self.assertTrue(report["replay"]["audit_replayed"])

    def test_audit_contract_drift_reuses_stage_bound_coverage(self):
        coverage = valid_coverage()
        store = new_store()
        run_engine(
            store,
            FakeTransport([
                (coverage, settled_usage()),
                (provider_audit_core(coverage), settled_usage()),
                (supported_detail_payload(coverage), settled_usage()),
            ]),
        )
        drift = FakeTransport([
            (supported_detail_payload(coverage), settled_usage()),
        ])

        with patch.object(
            cv, "DETAIL_AUDIT_CONTRACT_VERSION", "coverage-v1.2-detail-next"
        ):
            report, usage = run_engine(store, drift)

        self.assertEqual(
            [call["stage"] for call in drift.calls],
            ["coverage_v1.fact_audit_details"],
        )
        self.assertTrue(report["replay"]["coverage_replayed"])
        self.assertTrue(report["replay"]["audit_core_replayed"])
        self.assertFalse(report["replay"]["audit_replayed"])
        self.assertEqual(usage["call_count"], 1)

    def test_lens_drift_invalidates_checkpoints(self):
        coverage = valid_coverage()
        store = new_store()
        run_engine(
            store,
            FakeTransport(
                [
                    (coverage, settled_usage()),
                    (supported_audit(coverage), settled_usage()),
                ]
            ),
        )
        drift_stack = ["truby", "enneagram", "story-stakes"]
        drift_coverage = valid_coverage(lens_stack=drift_stack)
        drift = FakeTransport(
            [
                (drift_coverage, settled_usage()),
                (supported_audit(drift_coverage), settled_usage()),
            ]
        )
        report, _usage = run_engine(store, drift, lenses=drift_stack)
        self.assertEqual(len(drift.calls), 2)
        self.assertFalse(report["replay"]["coverage_replayed"])

    def test_tampered_checkpoint_is_rejected(self):
        coverage = valid_coverage()
        store = new_store()
        run_engine(
            store,
            FakeTransport(
                [
                    (coverage, settled_usage()),
                    (supported_audit(coverage), settled_usage()),
                ]
            ),
        )
        # Corrupt the stored coverage payload on disk.
        [target] = list(store.root.glob("*/coverage.json"))
        record = json.loads(target.read_text(encoding="utf-8"))
        record["payload"]["coverage"]["story_spine"]["ending"] = "final falso"
        target.write_text(json.dumps(record), encoding="utf-8")
        with self.assertRaises(cv.CheckpointTamperedError):
            run_engine(store, FakeTransport([]))


class TestFactAudit(unittest.TestCase):
    def test_claims_are_factual_spine_only_and_bounded(self):
        claims = cv.build_audit_claims(valid_coverage())
        self.assertGreaterEqual(len(claims), cv.MIN_AUDIT_CLAIMS)
        self.assertLessEqual(len(claims), cv.MAX_AUDIT_CLAIMS)
        joined = json.dumps(claims)
        self.assertNotIn("grade", joined)
        self.assertNotIn("/10", joined)
        self.assertTrue(all(c["claim_id"] for c in claims))

    def test_detailed_evidence_result_cannot_disagree_with_guard(self):
        coverage = valid_coverage()
        audit = supported_audit(coverage)
        audit["existing_evidence_verdicts"][0]["classification"] = (
            "contradicted"
        )
        checks = cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT)
        page_map = cv.build_page_reference_map(SCREENPLAY_TEXT, 6, None)

        problems = cv.validate_audit_payload(
            audit,
            cv.build_audit_claims(coverage),
            coverage,
            page_map,
            checks,
        )

        self.assertTrue(
            any("guard.existing_evidence disagrees" in p for p in problems)
        )

    def test_global_absence_citation_inherits_failed_evidence_check(self):
        coverage = valid_coverage()
        coverage["concerns"][0]["point"] = (
            "The exposé arrives with no camera setup anywhere in the script."
        )
        detail_rows = cv.build_detail_audit_rows(
            coverage,
            cv.build_existing_evidence_checks(
                coverage,
                "[PAGE 3]\nRichie plants the exposé camera.\n",
            ),
        )
        evidence = [{
            "field_path": "concerns[0].point",
            "classification": "contradicted",
            "note": "Page 3 explicitly plants the camera.",
        }]
        citations = [{
            "owner": "concerns[0]",
            "classification": "supported",
            "note": "The local reveal quote exists.",
        }]

        reconciled = cv._reconcile_citation_relevance_with_evidence(
            citations, evidence, detail_rows
        )

        self.assertEqual(reconciled[0]["classification"], "contradicted")
        self.assertIn("Page 3 explicitly plants", reconciled[0]["note"])

    def test_global_absence_citation_cannot_be_fully_supported_by_local_quote(self):
        coverage = valid_coverage()
        coverage["concerns"][0]["point"] = (
            "The exposé has no camera setup anywhere in the screenplay."
        )
        detail_rows = cv.build_detail_audit_rows(
            coverage,
            cv.build_existing_evidence_checks(
                coverage,
                "[PAGE 3]\nThe exposé plays on a screen.\n",
            ),
        )
        evidence = [{
            "field_path": "concerns[0].point",
            "classification": "supported",
            "note": "The full-script search found no camera setup.",
        }]
        citations = [{
            "owner": "concerns[0]",
            "classification": "supported",
            "note": "The quoted exposé occurs on page 3.",
        }]

        reconciled = cv._reconcile_citation_relevance_with_evidence(
            citations, evidence, detail_rows
        )

        self.assertEqual(
            reconciled[0]["classification"], "partially_supported"
        )
        self.assertEqual(
            reconciled[0]["classification_normalized_from"], "supported"
        )

    def test_local_citation_ignores_unrelated_global_failure_in_same_lens(self):
        coverage = valid_coverage()
        coverage["lens_notes"][0]["analysis"] = (
            "The COITO sign lands cleanly on p.2. "
            "The exposé has no camera setup anywhere in the script on p.6."
        )
        coverage["lens_notes"][0]["page"] = 2
        detail_rows = cv.build_detail_audit_rows(
            coverage,
            cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT),
        )
        citation_row = next(
            row for row in detail_rows
            if row["kind"] == "citation_relevance"
            and row["identifier"] == "lens_notes[0]"
        )
        evidence = [{
            "field_path": "lens_notes[0].analysis",
            "classification": "contradicted",
            "note": "The camera is planted on page 5.",
        }]
        citations = [{
            "owner": "lens_notes[0]",
            "classification": "supported",
            "note": "The excerpt supports the local sign observation.",
        }]

        reconciled = cv._reconcile_citation_relevance_with_evidence(
            citations, evidence, detail_rows
        )

        self.assertEqual(
            citation_row["subject"]["claim_span"],
            "The COITO sign lands cleanly on p.2.",
        )
        self.assertEqual(reconciled[0]["classification"], "supported")

    def test_same_page_citation_claim_span_stays_conservative(self):
        local = "The COITO sign lands cleanly on p.2."
        global_claim = "No attempted joke appears anywhere on p.2."

        for prose in (
            f"{local} {global_claim}",
            f"{global_claim} {local}",
        ):
            with self.subTest(prose=prose):
                coverage = valid_coverage()
                coverage["lens_notes"][0]["analysis"] = prose
                coverage["lens_notes"][0]["page"] = 2
                row = next(
                    item
                    for item in cv.build_detail_audit_rows(
                        coverage,
                        cv.build_existing_evidence_checks(
                            coverage, SCREENPLAY_TEXT
                        ),
                    )
                    if item["kind"] == "citation_relevance"
                    and item["identifier"] == "lens_notes[0]"
                )

                self.assertEqual(row["subject"]["claim_span"], prose)

    def test_bare_laugh_free_claim_gets_full_screenplay_check(self):
        coverage = valid_coverage()
        coverage["concerns"][0]["point"] = "Pages 2-4 are laugh-free."

        checks = cv.build_existing_evidence_checks(
            coverage, SCREENPLAY_TEXT
        )

        check = next(
            row for row in checks
            if row["field_path"] == "concerns[0].point"
        )
        self.assertEqual(check["trigger"], "absolute_negative")

    def test_laugh_free_citation_cannot_prove_absence_by_itself(self):
        coverage = valid_coverage()
        coverage["concerns"][0]["point"] = (
            "Pages 2-4 are laugh-free with no attempted jokes."
        )
        coverage["concerns"][0]["page"] = 3
        detail_rows = cv.build_detail_audit_rows(
            coverage,
            cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT),
        )
        evidence = [{
            "field_path": "concerns[0].point",
            "classification": "supported",
            "note": "The complete range was inspected.",
        }]
        citations = [{
            "owner": "concerns[0]",
            "classification": "supported",
            "note": "The quoted line appears on page 3.",
        }]

        reconciled = cv._reconcile_citation_relevance_with_evidence(
            citations, evidence, detail_rows
        )

        self.assertEqual(
            reconciled[0]["classification"], "partially_supported"
        )

    def test_global_absence_detection_never_crosses_a_clause_boundary(self):
        for prose in (
            "There are no tonal landmines. This script has comic beats.",
            "The rules work without invention. Joke density later drops.",
        ):
            with self.subTest(prose=prose):
                self.assertIsNone(cv._GLOBAL_ABSENCE_CLAIM.search(prose))
        for prose in (
            "There are no attempted jokes anywhere in the script.",
            "Pages 73-82 are laugh-free.",
        ):
            with self.subTest(prose=prose):
                self.assertIsNotNone(cv._GLOBAL_ABSENCE_CLAIM.search(prose))

    def test_fact_repair_separates_local_citation_from_global_uncertainty(self):
        coverage = valid_coverage()
        item = coverage["concerns"][0]
        item["page"] = 6
        item["point"] = (
            "On p.6, Diego survives and stays with the children. "
            "The screenplay never identifies who activated the video."
        )
        self.assertEqual(
            cv._fact_repair_citation_scope_problems(coverage), []
        )

        item["point"] = (
            "On p.6, Diego survives, but no activation exists anywhere "
            "in the screenplay."
        )
        self.assertEqual(
            cv._fact_repair_citation_scope_problems(coverage),
            [
                "concerns[0].claim_span attaches a local citation to a "
                "global absence claim"
            ],
        )

    def test_reveal_detail_omitting_source_roles_fails_closed(self):
        coverage = valid_coverage()
        coverage["concerns"][0]["point"] = (
            "The video reveal has no camera source anywhere in the script."
        )
        source = """\
[PAGE 3]
A hidden camera records the bribe.
[PAGE 4]
The video appears on the screen.
[PAGE 5]
The footage continues.
"""
        checks = cv.build_existing_evidence_checks(coverage, source)
        row = next(
            item for item in cv.build_detail_audit_rows(coverage, checks)
            if item["identifier"] == "concerns[0].point"
        )
        payload = {"results": {
            row["slot"]: "supported: The camera and reveal are present."
        }}

        with self.assertRaisesRegex(
            cv.CoverageContractError, "result is not a JSON object"
        ):
            cv.decode_detail_audit_payload(payload, [row], source)

        focused_result = {
            "classification": "supported",
            "note": "The existing camera source is inferable.",
            "reviewed_roles": cv._focused_role_tokens(row["subject"]),
            "source_status": "inferable",
            "activation_status": "unconfirmed",
        }
        missing_role = copy.deepcopy(focused_result)
        missing_role["reviewed_roles"] = missing_role["reviewed_roles"][:-1]
        payload["results"][row["slot"]] = missing_role
        with self.assertRaisesRegex(
            cv.CoverageContractError, "reviewed_roles must name exactly"
        ):
            cv.decode_detail_audit_payload(payload, [row], source)

        payload["results"][row["slot"]] = focused_result
        evidence, _citations = cv.decode_detail_audit_payload(
            payload, [row], source
        )
        self.assertEqual(evidence[0]["classification"], "unsupported")
        self.assertIn(
            "FOCUSED_EVIDENCE_CONTRADICTION", evidence[0]["note"]
        )

        payload["results"][row["slot"]]["note"] = (
            "Add a new camera because no source exists."
        )
        evidence, _citations = cv.decode_detail_audit_payload(
            payload, [row], source
        )
        self.assertEqual(evidence[0]["classification"], "unsupported")
        self.assertIn(
            "FOCUSED_EVIDENCE_CONTRADICTION", evidence[0]["note"]
        )

        safe_row = copy.deepcopy(row)
        safe_row["subject"]["claim"] = (
            "Clarify activation of the existing camera footage."
        )
        payload["results"][row["slot"]] = copy.deepcopy(focused_result)
        for unsafe_claim in (
            "Add a brand-new camera before the reveal.",
            "Introduce an additional recording device before the reveal.",
            "Plant another camera before the reveal.",
            "Plant and play the video-exposure mechanism in Act 2.",
            "Show the hero placing or activating the camera.",
            "The existing source is insufficient, so create a camera for "
            "the climax.",
            "Add a second camera before the reveal.",
            "Introduce an extra recording device before the reveal.",
        ):
            with self.subTest(unsafe_claim=unsafe_claim):
                unsafe_row = copy.deepcopy(safe_row)
                unsafe_row["subject"]["claim"] = unsafe_claim
                decoded, _ = cv.decode_detail_audit_payload(
                    payload, [unsafe_row], source
                )
                self.assertEqual(decoded[0]["classification"], "unsupported")

        payload["results"][row["slot"]]["note"] = (
            "Clarify who activates the existing camera."
        )
        decoded, _ = cv.decode_detail_audit_payload(
            payload, [safe_row], source
        )
        self.assertEqual(decoded[0]["classification"], "supported")

        for safe_claim in (
            "Create a camera payoff for the existing p.73 setup.",
            "Add a camera-activation beat using the established device.",
            "Introduce a camera-activation moment for the existing source.",
        ):
            with self.subTest(safe_claim=safe_claim):
                safe_row["subject"]["claim"] = safe_claim
                decoded, _ = cv.decode_detail_audit_payload(
                    payload, [safe_row], source
                )
                self.assertEqual(decoded[0]["classification"], "supported")

    def test_six_malformed_focused_rows_get_one_typed_retry(self):
        coverage = valid_coverage()
        for concern in coverage["concerns"]:
            concern["point"] = (
                f"On p.{concern['page']}, the video appears. "
                "No activation scene exists anywhere for the video reveal."
            )
        for priority in coverage["development_priorities"]:
            priority.update({
                "priority": "Clarify activation of the existing video reveal",
                "why": "The source exists but delivery remains uncertain",
                "how": "Identify who activates the existing footage",
            })
        source = SCREENPLAY_TEXT.replace(
            "[PAGE 3]",
            "[PAGE 3]\nA hidden camera records the bribe.",
        ).replace(
            "[PAGE 4]",
            "[PAGE 4]\nThe video appears on the screen.",
        ).replace(
            "[PAGE 5]",
            "[PAGE 5]\nThe footage continues.",
        )
        checks = cv.build_existing_evidence_checks(coverage, source)
        sequence = supported_audit(coverage)["sequence_ledger"]
        rows = cv.build_detail_audit_rows(coverage, checks, sequence)
        focused_rows = [
            row for row in rows
            if isinstance(row.get("subject"), dict)
            and row["subject"].get("focused_evidence")
        ]
        self.assertEqual(len(focused_rows), 6)
        main_detail = {
            "results": {
                row["slot"]: (
                    grounded_detail_value(row, source)
                    if row["kind"] in {
                        "citation_relevance", "sequence_evidence",
                    }
                    else "supported: All evidence was reviewed."
                )
                for row in rows
            }
        }
        focused_retry = {
            "results": {
                row["slot"]: {
                    "classification": "supported",
                    "note": "Source exists; activation remains unconfirmed.",
                    "reviewed_roles": cv._focused_role_tokens(row["subject"]),
                    "source_status": "inferable",
                    "activation_status": "unconfirmed",
                }
                for row in focused_rows
            }
        }
        transport = FakeTransport([
            (coverage, settled_usage()),
            (provider_audit_core(coverage), settled_usage()),
            (main_detail, settled_usage()),
            (focused_retry, settled_usage()),
        ])

        report, usage = run_engine(
            new_store(),
            transport,
            text=source,
        )

        self.assertEqual(report["status"], "sealed")
        self.assertEqual(usage["call_count"], 4)
        self.assertEqual(
            transport.calls[3]["tool"]["name"],
            "submit_detail_audit_v1_2",
        )
        retry_prompt = "\n".join(
            str(block.get("text", ""))
            for block in transport.calls[3]["user_blocks"]
        )
        self.assertIn("rejected_candidate", retry_prompt)
        self.assertIn("required_roles", retry_prompt)
        self.assertLessEqual(
            cv.strict_schema_complexity(
                transport.calls[3]["tool"]["input_schema"]
            )["property_count"],
            cv.STRICT_BUDGET["property_count"],
        )

    def test_cosquillitas_malformed_count_gets_one_typed_retry(self):
        coverage = valid_coverage()
        coverage["story_spine"]["opposition"] = (
            "Tony bribes a trio of judges"
        )
        evidence = cv.build_existing_evidence_checks(
            coverage, SCREENPLAY_TEXT
        )
        count_row = next(
            row for row in cv.build_detail_audit_rows(coverage, evidence)
            if row["subject"].get("trigger") == "counting_claim"
        )
        typed_retry = {
            "results": {
                count_row["slot"]: {
                    "classification": "unsupported",
                    "observed_total": 0,
                    "observed_universe_total": 0,
                    "instances": [],
                    "note": "No bribed judges appear in the test screenplay.",
                }
            }
        }
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (provider_audit_core(coverage), settled_usage()),
                (supported_detail_payload(coverage), settled_usage()),
                (typed_retry, settled_usage()),
            ]
        )

        report, _usage = run_engine(new_store(), transport)

        self.assertEqual(report["status"], "needs_review")
        self.assertIn(
            "guard.existing_evidence",
            report["fact_audit"]["central_failures"],
        )
        result_row = next(
            row for row in report["fact_audit"]["existing_evidence_verdicts"]
            if row["field_path"] == "story_spine.opposition"
        )
        self.assertEqual(result_row["classification"], "unsupported")
        self.assertTrue(result_row["count_ledger"]["valid"])
        self.assertEqual(len(transport.calls), 4)
        self.assertEqual(
            transport.calls[3]["tool"]["name"],
            "submit_detail_audit_v1_2",
        )
        self.assertLessEqual(
            cv.strict_schema_complexity(
                transport.calls[3]["tool"]["input_schema"]
            )["property_count"],
            cv.STRICT_BUDGET["property_count"],
        )

    def test_count_retry_receives_rejected_candidate_and_exact_error(self):
        coverage = valid_coverage()
        coverage["story_spine"]["opposition"] = (
            "Tony bribes a trio of judges"
        )
        evidence = cv.build_existing_evidence_checks(
            coverage, SCREENPLAY_TEXT
        )
        count_row = next(
            row for row in cv.build_detail_audit_rows(coverage, evidence)
            if row["subject"].get("trigger") == "counting_claim"
        )
        main_detail = supported_detail_payload(coverage)
        main_detail["results"][count_row["slot"]] = json.dumps({
            "classification": "supported",
            "observed_total": 1,
            "observed_universe_total": 1,
            "instances": [{
                "label": "invented judge",
                "page": 1,
                "excerpt": "invented count evidence",
                "matches_claim": True,
                "multiplicity": 1,
            }],
            "note": "One invented instance was returned.",
        })
        corrected_retry = {
            "results": {
                count_row["slot"]: {
                    "classification": "unsupported",
                    "observed_total": 0,
                    "observed_universe_total": 0,
                    "instances": [],
                    "note": "No bribed judges appear in the test screenplay.",
                }
            }
        }
        transport = FakeTransport([
            (coverage, settled_usage()),
            (provider_audit_core(coverage), settled_usage()),
            (main_detail, settled_usage()),
            (corrected_retry, settled_usage()),
        ])

        report, _usage = run_engine(new_store(), transport)

        self.assertEqual(report["status"], "needs_review")
        retry_prompt = "\n".join(
            str(block.get("text", ""))
            for block in transport.calls[3]["user_blocks"]
        )
        self.assertIn(
            "instance 1 excerpt is not uniquely on its page", retry_prompt
        )
        self.assertIn("invented count evidence", retry_prompt)

    def test_malformed_prose_detail_gets_one_typed_retry(self):
        coverage = valid_coverage()
        checks = cv.build_existing_evidence_checks(
            coverage, SCREENPLAY_TEXT
        )
        rows = cv.build_detail_audit_rows(coverage, checks)
        target = next(
            row for row in rows if row["kind"] == "citation_relevance"
        )
        malformed = supported_detail_payload(coverage)
        malformed["results"][target["slot"]] = "supported"
        typed_retry = {
            "results": {
                target["slot"]: json.loads(grounded_detail_value(target))
            }
        }
        transport = FakeTransport([
            (coverage, settled_usage()),
            (provider_audit_core(coverage), settled_usage()),
            (malformed, settled_usage()),
            (typed_retry, settled_usage()),
        ])

        report, usage = run_engine(new_store(), transport)

        self.assertEqual(report["status"], "sealed")
        self.assertEqual(usage["call_count"], 4)
        self.assertEqual(
            transport.calls[3]["tool"]["name"],
            "submit_detail_audit_v1_2",
        )
        self.assertTrue(
            transport.calls[3]["stage"].endswith("_typed_b")
        )
        self.assertLessEqual(
            cv.strict_schema_complexity(
                transport.calls[3]["tool"]["input_schema"]
            )["property_count"],
            cv.STRICT_BUDGET["property_count"],
        )

    def test_main_detail_retries_every_non_string_typed_note(self):
        coverage = valid_coverage()
        checks = cv.build_existing_evidence_checks(
            coverage, SCREENPLAY_TEXT
        )
        target = next(
            row
            for row in cv.build_detail_audit_rows(coverage, checks)
            if row["kind"] == "citation_relevance"
        )
        valid_value = json.loads(grounded_detail_value(target))
        valid_retry = {"results": {target["slot"]: valid_value}}
        for invalid_note in (False, None, 7, [], {}):
            with self.subTest(invalid_note=invalid_note):
                malformed = supported_detail_payload(coverage)
                invalid_value = copy.deepcopy(valid_value)
                invalid_value["note"] = invalid_note
                malformed["results"][target["slot"]] = invalid_value
                transport = FakeTransport([
                    (coverage, settled_usage()),
                    (provider_audit_core(coverage), settled_usage()),
                    (malformed, settled_usage()),
                    (valid_retry, settled_usage()),
                ])

                report, _usage = run_engine(new_store(), transport)

                self.assertEqual(report["status"], "sealed")
                self.assertEqual(len(transport.calls), 4)
                self.assertEqual(
                    transport.calls[3]["tool"]["name"],
                    "submit_detail_audit_v1_2",
                )

    def test_supported_citation_note_cannot_deny_its_own_support(self):
        coverage = valid_coverage()
        rows = cv.build_detail_audit_rows(
            coverage,
            cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT),
        )
        target = next(
            row for row in rows if row["kind"] == "citation_relevance"
        )
        value = json.loads(grounded_detail_value(target))
        value["note"] = "The excerpt does not support the attached claim."

        decoded, reason = cv._decode_grounded_detail_value(
            value, target, SCREENPLAY_TEXT
        )

        self.assertIsNone(decoded)
        self.assertIn("contradicts its own note", str(reason))

    def test_supported_citation_note_rejects_fails_to_support(self):
        coverage = valid_coverage()
        target = next(
            row for row in cv.build_detail_audit_rows(
                coverage,
                cv.build_existing_evidence_checks(
                    coverage, SCREENPLAY_TEXT
                ),
            )
            if row["kind"] == "citation_relevance"
        )
        value = json.loads(grounded_detail_value(target))
        value["note"] = "The excerpt fails to support the attached claim."

        decoded, reason = cv._decode_grounded_detail_value(
            value, target, SCREENPLAY_TEXT
        )

        self.assertIsNone(decoded)
        self.assertIn("contradicts its own note", str(reason))

    def test_sequence_roster_and_knowers_require_complete_bound_evidence(self):
        source = (
            "[PAGE 1]\nFelipe, Jesus, Lidia, and Beatriz judge the contest "
            "together. Richie alone hears about the bribe.\n"
        )
        beat = {
            "order": 1,
            "phase": "climax",
            "actor": "Felipe, Jesus, and Lidia",
            "action": "The contest judges award scores.",
            "result": "The judges decide the contest.",
            "character_knowledge": "Cosquillitas know about the bribe.",
            "audience_knowledge": "The audience sees the result.",
            "page": 1,
        }
        target = next(
            row for row in cv.build_detail_audit_rows({}, [], [beat])
            if row["kind"] == "sequence_evidence"
        )
        value = {
            "classification": "supported",
            "checks": [
                {
                    "field": field,
                    "page": 1,
                    "excerpt": "Felipe, Jesus, Lidia, and Beatriz",
                    "supports": True,
                }
                for field in target["subject"]["required_fields"]
            ],
            "observed_actors": ["Felipe", "Jesus", "Lidia", "Beatriz"],
            "observed_knowers": ["Cosquillitas"],
            "note": "The source supports every field.",
        }

        decoded, reason = cv._decode_grounded_detail_value(
            value, target, source
        )

        self.assertIsNone(decoded)
        self.assertTrue(
            "actor roster" in str(reason)
            or "observed_knowers" in str(reason)
            or "knower roles are absent" in str(reason)
            or "claimed participant" in str(reason)
            or "atomic fact" in str(reason),
            reason,
        )

    def test_cosquillitas_aggregate_judges_fail_closed_but_count_is_valid(self):
        source = (
            "[PAGE 94]\n"
            "Los jueces alzan sus paletas de calificaciones.\n"
            "Vemos al primer Juez. Primer calificación... 10.\n"
            "Es turno del segundo Juez. Segundo Juez... 10!\n"
            "El tercer Juez alza su paleta. Voltea a ver a Tony.\n"
            "Tercer Juez... Tercer Juez confirma su nota.\n"
            "El quinto Juez muestra una calificacion distinta.\n"
            "The 5th judge reveals a different score.\n"
            "El publico vuelve a exclamar.\n"
            "[PAGE 95]\n"
            "Judges 1, 2, 3, and 4 score 10, 10, 5, and 2.\n"
            "El publico ve las notas 10, 10, 5 y 2.\n"
            "El Juez la levanta y sonríe maliciosamente.\n"
            "Los nuevos reyes y ganadores del CINLTT, LOS CHAVOS.\n"
        )
        beat = {
            "order": 1,
            "phase": "climax",
            "actor": "The judges",
            "action": (
                "Judge 1 gives 10, Judge 2 gives 10, Judge 3 gives 5, "
                "and Judge 4 gives 2 on pp.94-95."
            ),
            "result": "Los Chavos are declared winners on p.95.",
            "character_knowledge": "NOT LOCATED",
            "audience_knowledge": (
                "The audience sees every score on pp.94-95."
            ),
            "page": 94,
        }
        rows = cv.build_detail_audit_rows({}, [], [beat])
        count_target = next(
            row for row in rows
            if row["subject"].get("trigger") == "counting_claim"
        )
        target = next(row for row in rows if row["kind"] == "sequence_evidence")
        excerpts = {
            "actor": "Los jueces alzan sus paletas de calificaciones",
            "action": "Judges 1, 2, 3, and 4 score 10, 10, 5, and 2",
            "result": "Los nuevos reyes y ganadores del CINLTT",
            "audience_knowledge": "El publico ve las notas 10, 10, 5 y 2",
        }
        pages = {
            "actor": 94,
            "action": 95,
            "result": 95,
            "audience_knowledge": 95,
        }
        value = {
            "classification": "supported",
            "checks": [
                {
                    "field": field,
                    "page": pages[field],
                    "excerpt": excerpts[field],
                    "supports": True,
                }
                for field in target["subject"]["required_fields"]
            ],
            "observed_actors": ["Los jueces"],
            "observed_knowers": [],
            "note": "The bound Spanish passage supports the judge sequence.",
        }
        count_value = {
            "classification": "supported",
            "observed_total": 4,
            "observed_universe_total": 4,
            "instances": [
                {
                    "label": "first judge",
                    "page": 94,
                    "excerpt": "Vemos al primer Juez",
                    "matches_claim": True,
                    "multiplicity": 1,
                },
                {
                    "label": "second judge",
                    "page": 94,
                    "excerpt": "Es turno del segundo Juez",
                    "matches_claim": True,
                    "multiplicity": 1,
                },
                {
                    "label": "third judge",
                    "page": 94,
                    "excerpt": "El tercer Juez alza su paleta",
                    "matches_claim": True,
                    "multiplicity": 1,
                },
                {
                    "label": "fourth judge",
                    "page": 95,
                    "excerpt": "El Juez la levanta y sonríe maliciosamente",
                    "matches_claim": True,
                    "multiplicity": 1,
                },
            ],
            "note": "Four distinct judge score beats are staged on pages 94-95.",
        }

        decoded, reason = cv._decode_grounded_detail_value(
            value, target, source
        )
        decoded_count = cv._decode_count_audit_result(
            count_value, count_target["subject"], source
        )

        self.assertIsNone(decoded)
        self.assertTrue(
            "numeric fact" in str(reason)
            or "participant roles" in str(reason),
            reason,
        )
        self.assertTrue(decoded_count["count_ledger"]["valid"])
        self.assertEqual(decoded_count["count_ledger"]["observed_total"], 4)
        self.assertEqual(
            [
                instance["source_identity"]
                for instance in decoded_count["count_ledger"]["instances"]
            ],
            ["role:1", "role:2", "role:3", "role:unlabeled"],
        )

        five_judges = copy.deepcopy(beat)
        five_judges["action"] = (
            "Judge 1 gives 10, Judge 2 gives 10, Judge 3 gives 5, "
            "Judge 4 gives 2, and Judge 5 gives 1 on pp.94-95."
        )
        five_subject = cv._sequence_numbered_role_count_subject(
            five_judges, 95
        )
        self.assertIsNotNone(five_subject)
        rejected_count = cv._decode_count_audit_result(
            count_value, five_subject, source
        )
        self.assertFalse(rejected_count["count_ledger"]["valid"])
        self.assertIn(
            "mismatched observed total",
            rejected_count["count_ledger"]["reason"],
        )
        word_five = copy.deepcopy(beat)
        word_five["action"] = (
            "First Judge scores, Second Judge scores, Third Judge scores, "
            "Fourth Judge scores, and Fifth Judge scores on pp.94-95."
        )
        word_five_subject = cv._sequence_numbered_role_count_subject(
            word_five, 95
        )
        self.assertIsNotNone(word_five_subject)
        rejected_word_five = cv._decode_count_audit_result(
            count_value, word_five_subject, source
        )
        self.assertFalse(rejected_word_five["count_ledger"]["valid"])
        self.assertIn(
            "mismatched observed total",
            rejected_word_five["count_ledger"]["reason"],
        )
        for subject in (count_target["subject"], five_subject):
            claimed_total = subject["claimed_total"]
            generic_multiplicity = {
                "classification": "supported",
                "observed_total": claimed_total,
                "observed_universe_total": claimed_total,
                "instances": [{
                    "label": "generic judge group",
                    "page": 94,
                    "excerpt": (
                        "Los jueces alzan sus paletas de calificaciones"
                    ),
                    "matches_claim": True,
                    "multiplicity": claimed_total,
                }],
                "note": "A generic group reference cannot prove its size.",
            }
            with self.subTest(generic_multiplicity=claimed_total):
                rejected_generic = cv._decode_count_audit_result(
                    generic_multiplicity, subject, source
                )
                self.assertFalse(
                    rejected_generic["count_ledger"]["valid"]
                )
                self.assertIn(
                    "must represent one distinct role",
                    rejected_generic["count_ledger"]["reason"],
                )

        for false_fifth_excerpt, expected_reason in (
            (
                "Los jueces alzan sus paletas de calificaciones",
                "collective role reference",
            ),
            (
                "El publico vuelve a exclamar",
                "does not name the counted role",
            ),
        ):
            false_five = copy.deepcopy(count_value)
            false_five["observed_total"] = 5
            false_five["observed_universe_total"] = 5
            false_five["instances"].append({
                "label": "provider supplied fifth judge",
                "page": 94,
                "excerpt": false_fifth_excerpt,
                "matches_claim": True,
                "multiplicity": 1,
            })
            with self.subTest(false_fifth_excerpt=false_fifth_excerpt):
                rejected_fifth = cv._decode_count_audit_result(
                    false_five, five_subject, source
                )
                self.assertFalse(rejected_fifth["count_ledger"]["valid"])
                self.assertIn(
                    expected_reason,
                    rejected_fifth["count_ledger"]["reason"],
                )

        repeated_third = copy.deepcopy(count_value)
        repeated_third["observed_total"] = 5
        repeated_third["observed_universe_total"] = 5
        repeated_third["instances"].insert(3, {
            "label": "provider relabeled third judge",
            "page": 94,
            "excerpt": "Tercer Juez... Tercer Juez confirma su nota",
            "matches_claim": True,
            "multiplicity": 1,
        })
        rejected_duplicate = cv._decode_count_audit_result(
            repeated_third, five_subject, source
        )
        self.assertFalse(rejected_duplicate["count_ledger"]["valid"])
        self.assertIn(
            "duplicates a counted role identity",
            rejected_duplicate["count_ledger"]["reason"],
        )

        wrong_four = copy.deepcopy(count_value)
        wrong_four["instances"][-1] = {
            "label": "provider substituted fifth judge",
            "page": 94,
            "excerpt": "El quinto Juez muestra una calificacion distinta",
            "matches_claim": True,
            "multiplicity": 1,
        }
        rejected_wrong_identity = cv._decode_count_audit_result(
            wrong_four, count_target["subject"], source
        )
        self.assertFalse(rejected_wrong_identity["count_ledger"]["valid"])
        self.assertIn(
            "outside the frozen action",
            rejected_wrong_identity["count_ledger"]["reason"],
        )
        for excerpt, expected_identity in (
            ("The 5th judge reveals a different score", "role:5"),
            ("The Judge Five reveals a different score", "role:5"),
            ("The Judge No. 5 reveals a different score", "role:5"),
            ("The Judge #5 reveals a different score", "role:5"),
            ("El Juez Cinco muestra una nota distinta", "role:5"),
            ("El Juez número cinco muestra una nota distinta", "role:5"),
            ("El 4.º Juez muestra una nota distinta", "role:4"),
            ("La Jueza 4th muestra una nota distinta", "role:4"),
        ):
            with self.subTest(identity_excerpt=excerpt):
                identity, identity_error = cv._sequence_distinct_role_identity(
                    excerpt, count_target["subject"]
                )
                self.assertIsNone(identity_error)
                self.assertEqual(identity, expected_identity)

        numeric_suffix_attack = copy.deepcopy(count_value)
        numeric_suffix_attack["instances"][-1] = {
            "label": "provider called this the fourth judge",
            "page": 94,
            "excerpt": "The 5th judge reveals a different score",
            "matches_claim": True,
            "multiplicity": 1,
        }
        rejected_numeric_suffix = cv._decode_count_audit_result(
            numeric_suffix_attack, count_target["subject"], source
        )
        self.assertFalse(rejected_numeric_suffix["count_ledger"]["valid"])
        self.assertIn(
            "outside the frozen action",
            rejected_numeric_suffix["count_ledger"]["reason"],
        )

        judges_three_four = copy.deepcopy(beat)
        judges_three_four["action"] = (
            "Judge 3 gives 5 and Judge 4 gives 2 on pp.94-95."
        )
        three_four_subject = cv._sequence_numbered_role_count_subject(
            judges_three_four, 95
        )
        one_two = copy.deepcopy(count_value)
        one_two["observed_total"] = 2
        one_two["observed_universe_total"] = 2
        one_two["instances"] = one_two["instances"][:2]
        rejected_wrong_range = cv._decode_count_audit_result(
            one_two, three_four_subject, source
        )
        self.assertFalse(rejected_wrong_range["count_ledger"]["valid"])
        self.assertIn(
            "outside the frozen action",
            rejected_wrong_range["count_ledger"]["reason"],
        )

    def test_observed_actor_name_requires_a_full_word_boundary(self):
        people, reason = cv._normalize_observed_people(
            ["Carlo"],
            field="observed_actors",
            excerpt="Carlos scores the decisive goal",
        )

        self.assertIsNone(people)
        self.assertIn("names are absent", str(reason))

    def test_legacy_observed_people_cannot_bypass_atomic_fact_validation(self):
        source = (
            "[PAGE 1]\n"
            "Carlos wins the contest.\n"
            "Carlos knows the door is open.\n"
            "The audience sees Carlos win.\n"
        )
        beat = {
            "order": 1,
            "phase": "climax",
            "actor": "Carlos",
            "action": "Carlos wins the contest.",
            "result": "Carlos wins the contest.",
            "character_knowledge": "Carlos knows the murder occurred.",
            "audience_knowledge": "The audience sees Carlos win.",
            "page": 1,
        }
        row = cv.build_detail_audit_rows({}, [], [beat])[0]
        excerpts = {
            "actor": "Carlos wins the contest",
            "action": "Carlos wins the contest",
            "result": "Carlos wins the contest",
            "character_knowledge": "Carlos knows the door is open",
            "audience_knowledge": "The audience sees Carlos win",
        }
        value = {
            "classification": "supported",
            "checks": [
                {
                    "field": field,
                    "page": 1,
                    "excerpt": excerpts[field],
                    "supports": True,
                }
                for field in row["subject"]["required_fields"]
            ],
            "observed_actors": ["Carlos"],
            "observed_knowers": ["Carlos"],
            "note": "Every legacy field is supported.",
        }

        decoded, reason = cv._decode_grounded_detail_value(
            value, row, source
        )

        self.assertIsNone(decoded)
        self.assertIn("atomic fact", str(reason))

    def test_sequence_detail_rejects_added_generic_actor_and_knower_roles(self):
        source = "[PAGE 1]\nThe judges score the finalist and announce the result.\n"
        base = {
            "order": 1,
            "phase": "climax",
            "actor": "The judges",
            "action": "The judges score the finalist.",
            "result": "The judges announce the result.",
            "character_knowledge": "The judges know the result.",
            "audience_knowledge": "The audience sees the result.",
            "page": 1,
        }
        for field, claim, expected in (
            ("actor", "The judges and runners", "actor roles are absent"),
            ("actor", "The judges with runners", "actor roles are absent"),
            (
                "character_knowledge",
                "The judges and runners know the result.",
                "knower roles are absent",
            ),
        ):
            with self.subTest(field=field):
                beat = copy.deepcopy(base)
                beat[field] = claim
                target = cv.build_detail_audit_rows({}, [], [beat])[0]
                value = {
                    "classification": "supported",
                    "checks": [
                        {
                            "field": required,
                            "page": 1,
                            "excerpt": "The judges score the finalist",
                            "supports": True,
                        }
                        for required in target["subject"]["required_fields"]
                    ],
                    "observed_actors": ["The judges"],
                    "observed_knowers": ["The judges"],
                    "note": "The source supports every field.",
                }

                decoded, reason = cv._decode_grounded_detail_value(
                    value, target, source
                )

        self.assertIsNone(decoded)
        self.assertTrue(
            expected in str(reason)
            or "actor roster" in str(reason)
            or "claim predicate" in str(reason)
            or (
                field == "character_knowledge"
                and "atomic fact" in str(reason)
                    ),
                    reason,
                )

        named_source = (
            "[PAGE 1]\nCarlos scores the finalist and announces the result.\n"
            "Carlos announces the result.\n"
            "Carlos knows the result.\n"
            "The audience sees Carlos announce the result.\n"
        )
        named_beat = {
            **base,
            "actor": "Carlos with runners",
            "action": "Carlos scores the finalist.",
            "result": "Carlos announces the result.",
            "character_knowledge": "Carlos knows the result.",
        }
        target = cv.build_detail_audit_rows({}, [], [named_beat])[0]
        value = {
            "classification": "supported",
            "checks": [
                {
                    "field": required,
                    "page": 1,
                    "excerpt": "Carlos scores the finalist and announces",
                    "supports": True,
                }
                for required in target["subject"]["required_fields"]
            ],
            "observed_actors": ["Carlos"],
            "observed_knowers": ["Carlos"],
            "note": "The source supports every field.",
        }

        decoded, reason = cv._decode_grounded_detail_value(
            value, target, named_source
        )

        self.assertIsNone(decoded)
        self.assertTrue(
            "actor roles are absent" in str(reason)
            or "actor roster" in str(reason),
            reason,
        )

        short_beat = {
            **base,
            "actor": "DJ",
            "character_knowledge": "NOT LOCATED",
        }
        target = cv.build_detail_audit_rows({}, [], [short_beat])[0]
        value = {
            "classification": "supported",
            "checks": [
                {
                    "field": required,
                    "page": 1,
                    "excerpt": "The judges score the finalist",
                    "supports": True,
                }
                for required in target["subject"]["required_fields"]
            ],
            "observed_actors": [],
            "observed_knowers": [],
            "note": "The source supports every field.",
        }

        decoded, reason = cv._decode_grounded_detail_value(
            value, target, source
        )

        self.assertIsNone(decoded)
        self.assertTrue(
            "omits a claimed actor" in str(reason)
            or "does not identify the beat actor" in str(reason),
            reason,
        )

        sentinel_beat = {**base, "actor": "N/A"}
        target = cv.build_detail_audit_rows({}, [], [sentinel_beat])[0]
        value = {
            "classification": "supported",
            "checks": [
                {
                    "field": required,
                    "page": 1,
                    "excerpt": "The judges score the finalist",
                    "supports": True,
                }
                for required in target["subject"]["required_fields"]
            ],
            "observed_actors": [],
            "observed_knowers": ["The judges"],
            "note": "The source supports every field.",
        }

        decoded, reason = cv._decode_grounded_detail_value(
            value, target, source
        )

        self.assertIsNone(decoded)
        self.assertTrue(
            "actor roles are absent" in str(reason)
            or "does not identify the beat actor" in str(reason),
            reason,
        )

        for claim in (
            "Carlos",
            "Carlos knows the result, and runners know it too.",
            "Carlos knows the result; runners are aware too.",
            "Carlos knows the result while runners find out too.",
            "Carlos knows the result. Runners become aware too.",
            "Carlos knows the result: runners are aware too.",
            "Carlos knows the result, although runners are aware too.",
            "Carlos knows the result — runners are aware too.",
            "Carlos knows the result\nrunners are aware too.",
            "Carlos knows the result (runners are aware too).",
            "Carlos knows the result [runners are aware too].",
            "Carlos knows the result / runners are aware too.",
            (
                "Carlos knows the result although the extremely patient "
                "championship runners are aware too."
            ),
        ):
            with self.subTest(claim=claim):
                multi_knowledge_beat = {
                    **base,
                    "actor": "Carlos",
                    "action": "Carlos announces the result.",
                    "result": "Carlos announces the result.",
                    "character_knowledge": claim,
                    "audience_knowledge": (
                        "The audience sees Carlos announce the result."
                    ),
                }
                target = cv.build_detail_audit_rows(
                    {}, [], [multi_knowledge_beat]
                )[0]
                value = {
                    "classification": "supported",
                    "checks": [
                        {
                            "field": required,
                            "page": 1,
                            "excerpt": (
                                "Carlos knows the result"
                                if required == "character_knowledge"
                                else (
                                    "The audience sees Carlos announce the result"
                                    if required == "audience_knowledge"
                                    else "Carlos announces the result"
                                )
                            ),
                            "supports": True,
                        }
                        for required in target["subject"]["required_fields"]
                    ],
                    "observed_actors": ["Carlos"],
                    "observed_knowers": ["Carlos"],
                    "note": "The source supports every field.",
                }

                decoded, reason = cv._decode_grounded_detail_value(
                    value, target, named_source
                )

                self.assertIsNone(decoded)
                self.assertIn("exactly one checked clause", str(reason))

    def test_historical_setup_page_cannot_ground_the_current_action(self):
        beat = {
            "order": 1,
            "phase": "climax",
            "actor": "Diego",
            "action": (
                "Diego stops the final penalty on p.6 "
                "(as threatened, seen earlier on p.4)."
            ),
            "result": "Diego completes the decisive save.",
            "character_knowledge": "Diego knows the result.",
            "audience_knowledge": "The audience sees the save.",
            "page": 6,
        }
        target = cv.build_detail_audit_rows({}, [], [beat])[0]
        value = {
            "classification": "supported",
            "checks": [
                {
                    "field": field,
                    "page": 4 if field == "action" else 6,
                    "excerpt": (
                        "Román Vega amenaza con quitar la cancha"
                        if field == "action"
                        else "Diego detiene el último penal"
                    ),
                    "supports": True,
                }
                for field in target["subject"]["required_fields"]
            ],
            "observed_actors": ["Diego"],
            "observed_knowers": ["Diego"],
            "note": "The source supports every field.",
        }

        decoded, reason = cv._decode_grounded_detail_value(
            value, target, SCREENPLAY_TEXT
        )

        self.assertIsNone(decoded)
        self.assertEqual(reason, "action evidence is outside its beat pages")

    def test_actor_evidence_must_stay_inside_the_action_interval(self):
        source = (
            "[PAGE 4]\nDiego prepares the trap before the final.\n"
            "[PAGE 6]\nDiego stops the final penalty and wins.\n"
        )
        beat = {
            "order": 1,
            "phase": "climax",
            "actor": "Diego",
            "action": (
                "Diego stops the final penalty on p.6 "
                "(as prepared, seen earlier on p.4)."
            ),
            "result": "Diego wins the contest.",
            "character_knowledge": "Diego knows the result.",
            "audience_knowledge": "The audience sees the save.",
            "page": 6,
        }
        target = cv.build_detail_audit_rows({}, [], [beat])[0]
        value = {
            "classification": "supported",
            "checks": [
                {
                    "field": field,
                    "page": 4 if field == "actor" else 6,
                    "excerpt": (
                        "Diego prepares the trap"
                        if field == "actor"
                        else "Diego stops the final penalty"
                    ),
                    "supports": True,
                }
                for field in target["subject"]["required_fields"]
            ],
            "observed_actors": ["Diego"],
            "observed_knowers": ["Diego"],
            "note": "The source supports every field.",
        }

        decoded, reason = cv._decode_grounded_detail_value(
            value, target, source
        )

        self.assertIsNone(decoded)
        self.assertEqual(reason, "actor evidence is outside its beat pages")

    def test_unrelated_excerpt_cannot_ground_false_sequence_beat(self):
        source = (
            "[PAGE 1]\nDante hands cash to the judges while Tony watches.\n"
        )
        beat = {
            "order": 1,
            "phase": "climax",
            "actor": "Richie",
            "action": "Richie wins the contest.",
            "result": "The contest is fair.",
            "character_knowledge": "Richie knows the result.",
            "audience_knowledge": "The audience sees Richie win.",
            "page": 1,
        }
        target = next(
            row for row in cv.build_detail_audit_rows({}, [], [beat])
            if row["kind"] == "sequence_evidence"
        )
        value = {
            "classification": "supported",
            "checks": [
                {
                    "field": field,
                    "page": 1,
                    "excerpt": "Dante hands cash to the judges",
                    "supports": True,
                }
                for field in target["subject"]["required_fields"]
            ],
            "observed_actors": [],
            "observed_knowers": [],
            "note": "The source supports every field.",
        }

        decoded, reason = cv._decode_grounded_detail_value(
            value, target, source
        )

        self.assertIn(
            "audience_knowledge", target["subject"]["required_fields"]
        )
        self.assertIsNone(decoded)
        self.assertTrue(
            "omits a claimed actor" in str(reason)
            or "atomic fact" in str(reason)
            or "does not identify the beat actor" in str(reason),
            reason,
        )

    def test_public_detail_flow_uses_not_located_instead_of_nearby_text(self):
        source = SCREENPLAY_TEXT.replace(
            (
                "Diego detiene el último penal de la final y se desploma "
                "sobre el pasto.\n"
            ),
            (
                "Diego detiene el último penal de la final y se desploma "
                "sobre el pasto.\n"
                "Carlos abre la puerta.\n"
                "La multitud come palomitas.\n"
                "Una cámara graba el pasillo.\n"
                "Diego entiende que su corazón corre peligro.\n"
            ),
        )
        coverage = valid_coverage()
        audit = provider_audit_core(coverage)
        normalized = cv.normalize_audit_tool_input(
            copy.deepcopy(audit), range(1, 7)
        )
        rows = cv.build_detail_audit_rows(
            coverage,
            cv.build_existing_evidence_checks(coverage, source),
            normalized["sequence_ledger"],
        )
        target = next(
            row for row in rows
            if row["kind"] == "sequence_evidence"
            and row["identifier"] == "sequence_ledger[1]"
        )
        anchors = cv._source_anchor_catalog(source)

        def source_id(fragment: str) -> str:
            return next(
                anchor_id for anchor_id, anchor in anchors.items()
                if fragment in anchor["excerpt"]
            )

        def token(field: str, anchor_id: str) -> str:
            return f"{target['slot']}:{field}:{anchor_id}"

        main_detail = typed_detail_payload_for_rows(rows, source)
        target_group = cv._detail_result_group(target)
        target_index = next(
            index for index, value in enumerate(main_detail[target_group])
            if value["slot"] == target["slot"]
        )
        main_detail[target_group][target_index] = {
            "slot": target["slot"],
            "classification": "supported",
            "note": "Every selected line supports the frozen beat.",
            "actor_source_id": token(
                "actor", source_id("Diego detiene el último penal")
            ),
            "action_source_id": token(
                "action", source_id("Carlos abre la puerta")
            ),
            "result_source_id": token(
                "result", source_id("Carlos abre la puerta")
            ),
            "character_knowledge_source_id": token(
                "character_knowledge",
                source_id("Diego entiende que su corazón"),
            ),
            "audience_knowledge_source_id": token(
                "audience_knowledge", source_id("Carlos abre la puerta")
            ),
            "character_knowledge_status": "checked",
        }
        recovery = {
            target_group: [{
                "slot": target["slot"],
                "classification": "partially_supported",
                "note": (
                    "The actor and knowledge are located; the other claims "
                    "lack relevant anchors."
                ),
                "actor_source_id": token(
                    "actor", source_id("Diego detiene el último penal")
                ),
                "action_source_id": cv.SEQUENCE_SOURCE_NOT_LOCATED,
                "result_source_id": cv.SEQUENCE_SOURCE_NOT_LOCATED,
                "character_knowledge_source_id": token(
                    "character_knowledge",
                    source_id("Diego entiende que su corazón"),
                ),
                "audience_knowledge_source_id": (
                    cv.SEQUENCE_SOURCE_NOT_LOCATED
                ),
                "character_knowledge_status": "checked",
            }],
        }
        transport = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (main_detail, settled_usage()),
            (recovery, settled_usage()),
        ])

        report, usage = run_engine(
            new_store(), transport, text=source, max_calls=4
        )

        self.assertEqual(usage["call_count"], 4)
        self.assertEqual(report["status"], "needs_review")
        self.assertFalse(report["diagnostics"]["fact_repair"]["attempted"])
        sequence_result = next(
            row for row in report["fact_audit"]["sequence_evidence"]
            if row["field_path"] == target["identifier"]
        )
        self.assertEqual(sequence_result["classification"], "partially_supported")
        checks = {
            check["field"]: check for check in sequence_result["checks"]
        }
        self.assertTrue(checks["actor"]["supports"])
        self.assertTrue(checks["character_knowledge"]["supports"])
        for field in ("action", "result", "audience_knowledge"):
            self.assertFalse(checks[field]["supports"])
            self.assertNotIn("source_anchor_id", checks[field])
        recovery_schema = transport.calls[3]["tool"]["input_schema"][
            "properties"
        ][target_group]["items"]["properties"]
        self.assertNotIn("unsupported_fields", recovery_schema)
        self.assertEqual(
            recovery_schema["classification"]["enum"],
            list(cv.SEQUENCE_AUDIT_CLASSIFICATIONS),
        )
        self.assertRegex(
            recovery[target_group][0]["actor_source_id"],
            recovery_schema["actor_source_id"]["pattern"],
        )
        self.assertRegex(
            cv.SEQUENCE_SOURCE_NOT_LOCATED,
            recovery_schema["action_source_id"]["pattern"],
        )
        recovery_prompt = "\n".join(
            str(block.get("text", ""))
            for block in transport.calls[3]["user_blocks"]
        )
        self.assertIn(cv.SEQUENCE_SOURCE_NOT_LOCATED, recovery_prompt)
        self.assertIn("<slot>:<field>:<source_id>", recovery_prompt)
        self.assertIn("partially_supported only for a mix", recovery_prompt)

    def test_final_grounding_failure_never_trusts_same_page_siblings(self):
        source = "[PAGE 1]\nDiego performs the dance backstage."
        beat = {
            "order": 1,
            "phase": "climax",
            "actor": "Diego",
            "action": "Diego wins the contest.",
            "result": "The judges award Diego the trophy.",
            "character_knowledge": "NOT LOCATED",
            "audience_knowledge": "The audience sees Diego win.",
            "page": 1,
        }
        row = next(
            row for row in cv.build_detail_audit_rows({}, [], [beat])
            if row["kind"] == "sequence_evidence"
        )
        rejected = {
            "classification": "supported",
            "checks": [
                {
                    "field": field,
                    "page": 1,
                    "excerpt": "Diego performs the dance backstage",
                    "supports": True,
                }
                for field in row["subject"]["required_fields"]
            ],
            "note": "Every field is supported.",
        }

        unresolved = cv._unclassified_detail_result(
            row, rejected, "result evidence is unrelated", source
        )

        self.assertEqual(unresolved["classification"], "unclassified")
        self.assertEqual(
            [check["field"] for check in unresolved["accepted_checks"]],
            ["actor"],
        )
        self.assertEqual(
            unresolved["unresolved_fields"],
            ["action", "result", "audience_knowledge"],
        )
        self.assertFalse(unresolved["grounding_valid"])

    def test_named_sequence_actor_roster_must_exist_on_beat_page(self):
        source = """\
[PAGE 1]
Dante hands cash to the judges as Tony watches.
"""
        beat = {
            "order": 1,
            "phase": "climax",
            "actor": "Carlos Bonavides, Lucila Mariscal and Rafael Inclán",
            "action": "The judges accept the bribe.",
            "result": "The contest is corrupted.",
            "character_knowledge": "Dante knows the judges accepted.",
            "audience_knowledge": "The audience sees the bribe.",
            "page": 1,
        }
        target = next(
            row for row in cv.build_detail_audit_rows({}, [], [beat])
            if row["kind"] == "sequence_evidence"
        )
        excerpt = "Dante hands cash to the judges"
        value = {
            "classification": "supported",
            "checks": [
                {
                    "field": field,
                    "page": 1,
                    "excerpt": excerpt,
                    "supports": True,
                }
                for field in target["subject"]["required_fields"]
            ],
            "observed_actors": [
                "Carlos", "Bonavides", "Lucila", "Mariscal", "Rafael",
                "Inclán",
            ],
            "observed_knowers": ["Dante"],
            "note": "Every sequence field is supported.",
        }

        decoded, reason = cv._decode_grounded_detail_value(
            value, target, source
        )

        self.assertIsNone(decoded)
        self.assertIn("actor roster names are absent", str(reason))

    def test_failed_character_knowledge_check_blocks_sequence_seal(self):
        coverage = valid_coverage()
        audit = provider_audit_core(coverage)
        source = SCREENPLAY_TEXT.replace(
            "[PAGE 6]",
            "[PAGE 6]\n"
            "Diego knows the result and understands the physical risk.",
        )
        normalized = cv.normalize_audit_tool_input(
            copy.deepcopy(audit), range(1, 7)
        )
        sequence_rows = [
            row for row in cv.build_detail_audit_rows(
                coverage,
                cv.build_existing_evidence_checks(coverage, source),
                normalized["sequence_ledger"],
            )
            if row["kind"] == "sequence_evidence"
        ]
        target = sequence_rows[0]
        rows = cv.build_detail_audit_rows(
            coverage,
            cv.build_existing_evidence_checks(coverage, source),
            normalized["sequence_ledger"],
        )
        detail = typed_detail_payload_for_rows(rows, source)
        group = cv._detail_result_group(target)
        value = next(
            item for item in detail[group]
            if item["slot"] == target["slot"]
        )
        value["classification"] = "partially_supported"
        value["note"] = (
            "The action occurs, but the named character never learns it."
        )
        value["character_knowledge_source_id"] = cv.SEQUENCE_SOURCE_NOT_LOCATED
        transport = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (detail, settled_usage()),
        ])

        report, _usage = run_engine(
            new_store(), transport, text=source
        )

        self.assertEqual(report["status"], "needs_review")
        self.assertIn(
            "guard.sequence_integrity",
            report["fact_audit"]["central_partials"],
        )

    def test_typed_retry_rejects_every_non_string_note(self):
        coverage = valid_coverage()
        checks = cv.build_existing_evidence_checks(
            coverage, SCREENPLAY_TEXT
        )
        target = next(
            row
            for row in cv.build_detail_audit_rows(coverage, checks)
            if row["kind"] == "citation_relevance"
        )
        malformed = supported_detail_payload(coverage)
        malformed["results"][target["slot"]] = "supported"
        for invalid_note in (False, None, 7, [], {}):
            with self.subTest(invalid_note=invalid_note):
                invalid_retry = {
                    "results": {
                        target["slot"]: {
                            **json.loads(grounded_detail_value(target)),
                            "note": invalid_note,
                        }
                    }
                }
                transport = FakeTransport([
                    (coverage, settled_usage()),
                    (provider_audit_core(coverage), settled_usage()),
                    (malformed, settled_usage()),
                    (invalid_retry, settled_usage()),
                ])

                with self.assertRaisesRegex(
                    cv.CoverageContractError,
                    f"malformed result for {target['slot']}",
                ):
                    run_engine(new_store(), transport)
                self.assertEqual(len(transport.calls), 4)

    def test_prose_detail_retry_resumes_without_repaying_main_batch(self):
        coverage = valid_coverage()
        checks = cv.build_existing_evidence_checks(
            coverage, SCREENPLAY_TEXT
        )
        target = next(
            row
            for row in cv.build_detail_audit_rows(coverage, checks)
            if row["kind"] == "citation_relevance"
        )
        malformed = supported_detail_payload(coverage)
        malformed["results"][target["slot"]] = "supported"
        typed_retry = {
            "results": {
                target["slot"]: json.loads(grounded_detail_value(target))
            }
        }
        store = new_store()
        first = FakeTransport([
            (coverage, settled_usage()),
            (provider_audit_core(coverage), settled_usage()),
            (malformed, settled_usage()),
            RuntimeError("proxy died during prose detail retry"),
        ])

        with self.assertRaises(RuntimeError):
            run_engine(store, first)

        resume = FakeTransport([(typed_retry, settled_usage())])
        report, usage = run_engine(store, resume)

        self.assertEqual(report["status"], "sealed")
        self.assertEqual(usage["call_count"], 1)
        self.assertEqual(len(resume.calls), 1)
        self.assertTrue(
            resume.calls[0]["stage"].endswith("_typed_b")
        )

    def test_typed_a_checkpoint_resumes_with_only_typed_b(self):
        coverage = valid_coverage()
        audit = provider_audit_core(coverage)
        normalized = cv.normalize_audit_tool_input(
            copy.deepcopy(audit), range(1, 7)
        )
        rows = cv.build_detail_audit_rows(
            coverage,
            cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT),
            normalized["sequence_ledger"],
        )
        text_row = next(
            row for row in rows
            if row["kind"] == "existing_evidence"
            and row["subject"].get("trigger") != "counting_claim"
            and not row["subject"].get("focused_evidence")
        )
        citation_row = next(
            row for row in rows if row["kind"] == "citation_relevance"
        )
        malformed = supported_detail_payload(coverage)
        malformed["results"][text_row["slot"]] = "supported"
        malformed["results"][citation_row["slot"]] = "supported"
        typed_a = typed_detail_payload_for_rows([text_row])
        typed_b = typed_detail_payload_for_rows([citation_row])
        store = new_store()
        first = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (malformed, settled_usage()),
            (typed_a, settled_usage()),
            RuntimeError("proxy died before typed B settled"),
        ])

        with self.assertRaises(RuntimeError):
            run_engine(store, first)

        self.assertEqual(
            [call["stage"] for call in first.calls[2:]],
            [
                "coverage_v1.fact_audit_details",
                "coverage_v1.fact_audit_details_typed_a",
                "coverage_v1.fact_audit_details_typed_b",
            ],
        )
        resume = FakeTransport([(typed_b, settled_usage())])
        report, usage = run_engine(store, resume)

        self.assertEqual(report["status"], "sealed")
        self.assertEqual(usage["call_count"], 1)
        self.assertEqual(
            [call["stage"] for call in resume.calls],
            ["coverage_v1.fact_audit_details_typed_b"],
        )

    def test_partial_typed_a_checkpoints_valid_rows_and_carries_only_failures(self):
        coverage = valid_coverage()
        audit = provider_audit_core(coverage)
        normalized = cv.normalize_audit_tool_input(
            copy.deepcopy(audit), range(1, 7)
        )
        rows = cv.build_detail_audit_rows(
            coverage,
            cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT),
            normalized["sequence_ledger"],
        )
        text_rows = [
            row for row in rows
            if row["kind"] == "existing_evidence"
            and row["subject"].get("trigger") != "counting_claim"
            and not row["subject"].get("focused_evidence")
        ][:2]
        citation_row = next(
            row for row in rows if row["kind"] == "citation_relevance"
        )
        malformed = supported_detail_payload(coverage)
        for row in [*text_rows, citation_row]:
            malformed["results"][row["slot"]] = "supported"
        partial_a = typed_detail_payload_for_rows([text_rows[0]])
        combined_b = typed_detail_payload_for_rows([
            text_rows[1], citation_row,
        ])
        store = new_store()
        first = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (malformed, settled_usage()),
            (partial_a, settled_usage()),
            RuntimeError("proxy stopped before final recovery"),
        ])

        with self.assertRaisesRegex(RuntimeError, "final recovery"):
            run_engine(store, first)

        self.assertEqual(
            set(first.calls[-1]["tool"]["input_schema"]["properties"]),
            {"text_results", "citation_results"},
        )
        self.assertIn(
            "# SCREENPLAY TEXT",
            "\n".join(
                str(block.get("text", ""))
                for block in first.calls[-1]["user_blocks"]
            ),
        )
        resume = FakeTransport([(combined_b, settled_usage())])
        report, usage = run_engine(store, resume)

        self.assertEqual(usage["call_count"], 1)
        self.assertEqual(
            [call["stage"] for call in resume.calls],
            ["coverage_v1.fact_audit_details_typed_b"],
        )
        first_identifier = text_rows[0]["identifier"]
        first_result = next(
            row for row in report["fact_audit"]["existing_evidence_verdicts"]
            if row["field_path"] == first_identifier
        )
        self.assertEqual(
            first_result["note"], "Confirmed against the complete screenplay."
        )

    def test_final_typed_recovery_checkpoints_valid_siblings_before_failing(self):
        coverage = valid_coverage()
        audit = provider_audit_core(coverage)
        normalized = cv.normalize_audit_tool_input(
            copy.deepcopy(audit), range(1, 7)
        )
        rows = cv.build_detail_audit_rows(
            coverage,
            cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT),
            normalized["sequence_ledger"],
        )
        citation_rows = [
            row for row in rows if row["kind"] == "citation_relevance"
        ][:2]
        malformed_main = supported_detail_payload(
            coverage, normalized
        )
        for row in citation_rows:
            malformed_main["results"][row["slot"]] = "supported"
        partial_final = typed_detail_payload_for_rows(citation_rows)
        partial_final["citation_results"][1].pop("supports")
        store = new_store()
        first = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (malformed_main, settled_usage()),
            (partial_final, settled_usage()),
        ])

        with self.assertRaisesRegex(
            cv.CoverageContractError, "recovery B returned a malformed result"
        ):
            run_engine(store, first)

        progress_path = next(
            store.root.glob("*/audit_details_progress.json")
        )
        progress = json.loads(progress_path.read_text(encoding="utf-8"))[
            "payload"
        ]
        rescued_owners = {
            row["owner"] for row in progress["citation_rows"]
        }
        self.assertIn(citation_rows[0]["identifier"], rescued_owners)
        self.assertNotIn(citation_rows[1]["identifier"], rescued_owners)
        self.assertEqual(
            progress["typed_b_plan"], [citation_rows[1]["slot"]]
        )
        self.assertEqual(progress["completed_typed_b_batches"], [])
        self.assertNotIn(
            citation_rows[0]["slot"],
            progress["grounded_retry_feedback"],
        )
        self.assertEqual(
            progress["grounded_retry_feedback"][citation_rows[1]["slot"]][
                "reason"
            ],
            "missing fields: supports",
        )
        rescued = next(
            row for row in progress["citation_rows"]
            if row["owner"] == citation_rows[0]["identifier"]
        )

        resume = FakeTransport([(
            typed_detail_payload_for_rows([citation_rows[1]]),
            settled_usage(),
        )])
        report, usage = run_engine(store, resume)

        self.assertEqual(usage["call_count"], 1)
        self.assertEqual(len(resume.calls), 1)
        retry_schema = resume.calls[0]["tool"]["input_schema"][
            "properties"
        ]["citation_results"]
        self.assertEqual(
            retry_schema["items"]["properties"]["slot"]["enum"],
            [citation_rows[1]["slot"]],
        )
        self.assertEqual(report["status"], "sealed")
        self.assertEqual(
            next(
                row for row in report["fact_audit"]["citation_relevance"]
                if row["owner"] == citation_rows[0]["identifier"]
            ),
            rescued,
        )

    def test_partial_typed_b_resume_at_call_cap_preserves_valid_rows(self):
        coverage = valid_coverage()
        audit = provider_audit_core(coverage)
        next(
            row for row in audit["verdicts"]
            if row["claim_id"] == "spine.turn_0"
        )["classification"] = "partially_supported"
        normalized = cv.normalize_audit_tool_input(
            copy.deepcopy(audit), range(1, 7)
        )
        rows = cv.build_detail_audit_rows(
            coverage,
            cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT),
            normalized["sequence_ledger"],
        )
        citation_rows = [
            row for row in rows if row["kind"] == "citation_relevance"
        ][:2]
        malformed_main = typed_detail_payload_for_rows(rows)
        for result in malformed_main["citation_results"]:
            if result["slot"] in {
                row["slot"] for row in citation_rows
            }:
                result.pop("supports")
        partial_final = typed_detail_payload_for_rows(citation_rows)
        partial_final["citation_results"][1].pop("supports")
        store = new_store()

        with self.assertRaisesRegex(
            cv.CoverageContractError, "recovery B returned a malformed result"
        ):
            run_engine(
                store,
                FakeTransport([
                    (coverage, settled_usage()),
                    (audit, settled_usage()),
                    (malformed_main, settled_usage()),
                    (partial_final, settled_usage()),
                ]),
                max_calls=5,
            )

        progress_path = next(
            store.root.glob("*/audit_details_progress.json")
        )
        record = json.loads(progress_path.read_text(encoding="utf-8"))
        payload = record["payload"]
        payload["detail_contract_version"] = (
            cv.PARTIAL_TYPED_B_PROGRESS_VERSION
        )
        payload["typed_b_plan"] = [
            row["slot"] for row in citation_rows
        ]
        payload["grounded_retry_plan"] = list(payload["typed_b_plan"])
        payload["completed_typed_b_batches"] = [
            cv.canonical_json_hash(citation_rows)
        ]
        payload["grounded_retry_feedback"][citation_rows[0]["slot"]] = {
            "reason": "stale feedback for an accepted row",
        }
        preserved = next(
            row for row in payload["citation_rows"]
            if row["owner"] == citation_rows[0]["identifier"]
        )
        progress_path.write_text(
            json.dumps(cv._sealed_record(record["binding"], payload)),
            encoding="utf-8",
        )
        budget_path = next(store.root.glob("*/budget.json"))
        receipts_path = next(store.root.glob("*/call_receipts.json"))
        budget_before = budget_path.read_bytes()
        receipts_before = receipts_path.read_bytes()

        resume = FakeTransport([])
        report, usage = run_engine(store, resume, max_calls=4)

        self.assertEqual(resume.calls, [])
        self.assertEqual(usage["call_count"], 0)
        self.assertEqual(report["status"], "needs_review")
        self.assertFalse(report["diagnostics"]["fact_repair"]["attempted"])
        self.assertIn(
            "spine.turn_0", report["fact_audit"]["central_partials"]
        )
        self.assertEqual(budget_path.read_bytes(), budget_before)
        self.assertNotEqual(receipts_path.read_bytes(), receipts_before)
        report_citations = {
            row["owner"]: row
            for row in report["fact_audit"]["citation_relevance"]
        }
        self.assertEqual(
            report_citations[citation_rows[0]["identifier"]], preserved
        )
        unresolved = report_citations[citation_rows[1]["identifier"]]
        self.assertEqual(unresolved["classification"], "unclassified")
        self.assertEqual(unresolved["grounding_status"], "unresolved")
        self.assertFalse(unresolved["grounding_valid"])
        migrated = json.loads(
            progress_path.read_text(encoding="utf-8")
        )["payload"]
        self.assertEqual(
            migrated["detail_contract_version"],
            cv.DETAIL_AUDIT_CONTRACT_VERSION,
        )
        self.assertEqual(migrated["typed_b_plan"], [])
        self.assertEqual(len(migrated["completed_typed_b_batches"]), 1)
        self.assertNotIn(
            citation_rows[0]["slot"],
            migrated["grounded_retry_plan"],
        )
        self.assertNotIn(
            citation_rows[0]["slot"],
            migrated["grounded_retry_feedback"],
        )
        self.assertIn(
            citation_rows[1]["slot"],
            migrated["grounded_retry_feedback"],
        )
        self.assertTrue(list(store.root.glob("*/audit.json")))

    def test_partial_typed_b_resume_at_dollar_cap_uses_no_transport(self):
        coverage = valid_coverage()
        audit = provider_audit_core(coverage)
        normalized = cv.normalize_audit_tool_input(
            copy.deepcopy(audit), range(1, 7)
        )
        rows = cv.build_detail_audit_rows(
            coverage,
            cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT),
            normalized["sequence_ledger"],
        )
        citation_rows = [
            row for row in rows if row["kind"] == "citation_relevance"
        ][:2]
        malformed_main = typed_detail_payload_for_rows(rows)
        for result in malformed_main["citation_results"]:
            if result["slot"] in {
                row["slot"] for row in citation_rows
            }:
                result.pop("supports")
        partial_final = typed_detail_payload_for_rows(citation_rows)
        partial_final["citation_results"][1].pop("supports")
        store = new_store()

        with self.assertRaisesRegex(
            cv.CoverageContractError, "recovery B returned a malformed result"
        ):
            run_engine(
                store,
                FakeTransport([
                    (coverage, settled_usage()),
                    (audit, settled_usage()),
                    (malformed_main, settled_usage()),
                    (partial_final, settled_usage()),
                ]),
                max_calls=5,
            )

        resume = FakeTransport([])
        with patch.object(
            cv, "_request_cost_ceiling_microusd", return_value=2_000
        ):
            report, usage = run_engine(
                store,
                resume,
                max_calls=5,
                max_cost_usd=0.241,
            )

        self.assertEqual(resume.calls, [])
        self.assertEqual(usage["call_count"], 0)
        self.assertEqual(report["status"], "needs_review")
        self.assertEqual(report["cost"]["call_count"], 4)
        unresolved = next(
            row for row in report["fact_audit"]["citation_relevance"]
            if row["owner"] == citation_rows[1]["identifier"]
        )
        self.assertEqual(unresolved["classification"], "unclassified")
        self.assertFalse(report["diagnostics"]["fact_repair"]["attempted"])

    def test_legacy_detail_requests_reconstruct_frozen_history(self):
        coverage = valid_coverage()
        normalized = cv.normalize_audit_tool_input(
            provider_audit_core(coverage), range(1, 7)
        )
        rows = cv.build_detail_audit_rows(
            coverage,
            cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT),
            normalized["sequence_ledger"],
        )
        selected = [
            next(row for row in rows if row["kind"] == "citation_relevance"),
            next(row for row in rows if row["kind"] == "sequence_evidence"),
        ]
        current = cv.build_detail_audit_user_blocks(
            SCREENPLAY_TEXT,
            "Prueba",
            coverage,
            cv.build_page_reference_map(SCREENPLAY_TEXT, 6, None),
            selected,
        )

        self.assertEqual(
            cv.canonical_json_hash(cv._legacy_detail_16_user_blocks(current)),
            "ceccf41853347e3b404d140ca41eee45942684ea6dfb7e049b2d8d467366ed07",
        )
        self.assertEqual(
            cv.canonical_json_hash(cv._legacy_detail_15_user_blocks(current)),
            "ccabe2d599a3f0fada198803f26a4324c7e5e8eaec945ae4453a564505d57473",
        )
        self.assertEqual(
            cv.canonical_json_hash(cv._legacy_detail_tool(
                cv.build_detail_audit_tool(selected)
            )),
            "2de9b7dbd1c18b0e476b4bca8359cb7fa5d612667922ce072aaf8b51e9b6cf9e",
        )

    def test_legacy_settled_typed_b_receipts_replay_after_prompt_bump(self):
        class FailProgressAfterTypedB(cv.LocalCheckpointStore):
            def __init__(self, root: Path):
                super().__init__(root)
                self.fail_detail_save = False
                self.fail_budget_settlement = False

            def save(self, key: str, stage: str, record: dict) -> None:
                if (
                    stage == "budget"
                    and self.fail_budget_settlement
                    and record.get("payload", {}).get("in_flight") is None
                ):
                    self.fail_budget_settlement = False
                    raise RuntimeError(
                        "crash after receipt before budget settlement"
                    )
                if stage == "audit_details_progress" and self.fail_detail_save:
                    self.fail_detail_save = False
                    raise RuntimeError("crash after typed B settlement")
                super().save(key, stage, record)

        current_builder = cv.build_detail_audit_user_blocks
        current_tool_builder = cv.build_detail_audit_tool

        def frozen_legacy_blocks(blocks, version):
            rebuilt = (
                cv._legacy_detail_16_user_blocks(blocks)
                if version == cv.LEGACY_FIELD_SOURCE_PROGRESS_VERSION
                else cv._legacy_detail_15_user_blocks(blocks)
            )
            self.assertIsNotNone(rebuilt)
            return rebuilt

        def frozen_legacy_tool(detail_rows):
            tool = current_tool_builder(detail_rows)
            properties = tool["input_schema"]["properties"]
            for group in (
                "sequence_results", "sequence_knowledge_results",
            ):
                if group not in properties:
                    continue
                item = properties[group]["items"]
                item_properties = item["properties"]
                source_keys = [
                    key for key in item_properties
                    if key.endswith("_source_id")
                ]
                fields = [
                    key.removesuffix("_source_id") for key in source_keys
                ]
                item_properties["classification"] = {
                    "type": "string",
                    "enum": [
                        "supported", "partially_supported", "unsupported",
                        "contradicted",
                    ],
                }
                for key in source_keys:
                    item_properties[key] = {"type": "string"}
                item_properties["unsupported_fields"] = {
                    "type": "array",
                    "items": {"type": "string", "enum": fields},
                    "maxItems": len(fields),
                }
                item["required"] = [
                    "slot", "classification", "note", *source_keys,
                    "unsupported_fields", "character_knowledge_status",
                ]
            return tool

        def legacy_payload(detail_rows):
            payload = typed_detail_payload_for_rows(detail_rows)
            fallback_source_id = next(iter(
                cv._source_anchor_catalog(SCREENPLAY_TEXT)
            ))
            for group in (
                "sequence_results", "sequence_knowledge_results",
            ):
                for value in payload.get(group, []):
                    unsupported = []
                    for key in [
                        field for field in value
                        if field.endswith("_source_id")
                    ]:
                        field = key.removesuffix("_source_id")
                        source_id = value[key]
                        if source_id == cv.SEQUENCE_SOURCE_NOT_LOCATED:
                            unsupported.append(field)
                            value[key] = fallback_source_id
                        else:
                            value[key] = source_id.split(":", 2)[2]
                    value["unsupported_fields"] = unsupported
            return payload

        cases = (
            (cv.PARTIAL_TYPED_B_PROGRESS_VERSION, False, (
                "bbaa17f9cb14b9b9f4683cc3e2cd3f5cb7445fe394a2245b1287748625021172"
            )),
            (cv.LEGACY_FIELD_SOURCE_PROGRESS_VERSION, False, (
                "23d3a4847735812b8ab10021416f2d419d85bc2265ef3b86e249552596342cda"
            )),
            (cv.LEGACY_FIELD_SOURCE_PROGRESS_VERSION, True, (
                "f1e3692a0b46e44f9d40d0fc25c28ad64d714a37d27db93d242362eb4f52b04c"
            )),
        )
        for version, uncommitted_prompt, expected_fingerprint in cases:
            with self.subTest(
                version=version, uncommitted_prompt=uncommitted_prompt
            ):
                coverage = valid_coverage()
                audit = provider_audit_core(coverage)
                normalized = cv.normalize_audit_tool_input(
                    copy.deepcopy(audit), range(1, 7)
                )
                rows = cv.build_detail_audit_rows(
                    coverage,
                    cv.build_existing_evidence_checks(
                        coverage, SCREENPLAY_TEXT
                    ),
                    normalized["sequence_ledger"],
                )
                citation_row = next(
                    row for row in rows
                    if row["kind"] == "citation_relevance"
                )
                sequence_rows = [
                    row for row in rows
                    if row["kind"] == "sequence_evidence"
                ]
                extra_sequence_row = sequence_rows[0]
                sequence_row = sequence_rows[1]
                typed_b_rows = [citation_row, sequence_row]
                malformed_main = legacy_payload(rows)
                citation_result = next(
                    result for result in malformed_main["citation_results"]
                    if result["slot"] == citation_row["slot"]
                )
                citation_result.pop("supports")
                sequence_group = cv._detail_result_group(sequence_row)
                sequence_result = next(
                    result for result in malformed_main[sequence_group]
                    if result["slot"] == sequence_row["slot"]
                )
                sequence_result.pop("action_source_id")
                store = FailProgressAfterTypedB(
                    Path(tempfile.mkdtemp()) / "cv1"
                )

                class ArmCrashTransport(FakeTransport):
                    def __call__(self, **kwargs):
                        result = super().__call__(**kwargs)
                        if str(kwargs.get("stage", "")).endswith("_typed_b"):
                            if uncommitted_prompt:
                                store.fail_budget_settlement = True
                            else:
                                store.fail_detail_save = True
                        return result

                def legacy_builder(*args, **kwargs):
                    blocks = frozen_legacy_blocks(
                        current_builder(*args, **kwargs), version
                    )
                    if uncommitted_prompt:
                        blocks.append({
                            "type": "text",
                            "text": "# HISTORICAL UNCOMMITTED PROMPT HOTFIX",
                        })
                    return blocks

                first = ArmCrashTransport([
                    (coverage, settled_usage()),
                    (audit, settled_usage()),
                    (malformed_main, settled_usage()),
                    (legacy_payload(typed_b_rows), settled_usage()),
                ])
                with patch.object(
                    cv, "DETAIL_AUDIT_CONTRACT_VERSION", version
                ), patch.object(
                    cv,
                    "build_detail_audit_user_blocks",
                    side_effect=legacy_builder,
                ), patch.object(
                    cv,
                    "build_detail_audit_tool",
                    side_effect=frozen_legacy_tool,
                ):
                    with self.assertRaisesRegex(
                        RuntimeError,
                        (
                            "crash after receipt before budget settlement"
                            if uncommitted_prompt
                            else "crash after typed B settlement"
                        ),
                    ):
                        run_engine(store, first, max_calls=4)

                self.assertEqual(
                    cv._request_fingerprint(first.calls[-1]),
                    expected_fingerprint,
                )
                progress_path = next(
                    store.root.glob("*/audit_details_progress.json")
                )
                before_resume = json.loads(
                    progress_path.read_text(encoding="utf-8")
                )["payload"]
                self.assertEqual(
                    before_resume["detail_contract_version"], version
                )
                self.assertEqual(
                    before_resume["completed_typed_b_batches"], []
                )
                budget_path = next(store.root.glob("*/budget.json"))
                receipts_path = next(
                    store.root.glob("*/call_receipts.json")
                )
                if uncommitted_prompt:
                    receipt_record = json.loads(
                        receipts_path.read_text(encoding="utf-8")
                    )
                    receipt = next(
                        value for value in receipt_record["payload"][
                            "receipts"
                        ].values()
                        if value.get("call_number") == 4
                    )
                    extra_group = cv._detail_result_group(
                        extra_sequence_row
                    )
                    extra_result = legacy_payload([
                        extra_sequence_row
                    ])[extra_group][0]
                    extra_result["classification"] = "unsupported"
                    extra_result["unsupported_fields"] = list(
                        extra_sequence_row["subject"]["required_fields"]
                    )
                    receipt["tool_input"].setdefault(
                        extra_group, []
                    ).append(extra_result)
                    receipts_path.write_text(
                        json.dumps(cv._sealed_record(
                            receipt_record["binding"],
                            receipt_record["payload"],
                        )),
                        encoding="utf-8",
                    )
                budget_before = budget_path.read_bytes()
                receipts_before = receipts_path.read_bytes()

                resume = FakeTransport([])
                report, usage = run_engine(store, resume, max_calls=4)

                self.assertEqual(resume.calls, [])
                self.assertEqual(report["status"], "sealed")
                self.assertEqual(usage["call_count"], 0)
                if uncommitted_prompt:
                    self.assertNotEqual(
                        budget_path.read_bytes(), budget_before
                    )
                    settled_budget = json.loads(
                        budget_path.read_text(encoding="utf-8")
                    )["payload"]
                    self.assertIsNone(settled_budget["in_flight"])
                    self.assertEqual(settled_budget["calls_started"], 4)
                    self.assertEqual(
                        settled_budget["usage"]["call_count"], 4
                    )
                else:
                    self.assertEqual(
                        budget_path.read_bytes(), budget_before
                    )
                self.assertNotEqual(
                    receipts_path.read_bytes(), receipts_before
                )
                after_resume = json.loads(
                    progress_path.read_text(encoding="utf-8")
                )["payload"]
                self.assertEqual(
                    after_resume["detail_contract_version"],
                    cv.DETAIL_AUDIT_CONTRACT_VERSION,
                )
                self.assertEqual(
                    len(after_resume["completed_typed_b_batches"]), 1
                )
                replayed_sequence = next(
                    result for result in after_resume["evidence_rows"]
                    if result.get("field_path") == sequence_row["identifier"]
                )
                replayed_citation = next(
                    result for result in after_resume["citation_rows"]
                    if result.get("owner") == citation_row["identifier"]
                )
                self.assertNotEqual(
                    replayed_sequence["classification"], "unclassified"
                )
                self.assertNotEqual(
                    replayed_citation["classification"], "unclassified"
                )
                if uncommitted_prompt:
                    ignored_extra = next(
                        result for result in after_resume["evidence_rows"]
                        if result.get("field_path")
                        == extra_sequence_row["identifier"]
                    )
                    self.assertNotEqual(
                        ignored_extra["classification"], "unsupported"
                    )

    def test_global_count_collision_requeues_only_invalid_typed_b_row(self):
        source = SCREENPLAY_TEXT.replace(
            "[PAGE 6]",
            "[PAGE 6]\n"
            "First judge takes the stage.\n"
            "Second judge takes the stage.\n"
            "First contestant takes the stage.\n"
            "Second contestant takes the stage.",
        )
        coverage = valid_coverage()
        coverage["story_spine"]["opposition"] = (
            "Two judges are bribed and two contestants perform."
        )
        audit = provider_audit_core(coverage)
        normalized = cv.normalize_audit_tool_input(
            copy.deepcopy(audit), range(1, 7)
        )
        rows = cv.build_detail_audit_rows(
            coverage,
            cv.build_existing_evidence_checks(coverage, source),
            normalized["sequence_ledger"],
        )
        count_rows = [
            row for row in rows
            if row.get("subject", {}).get("source_field_path")
            == "story_spine.opposition"
            and row.get("subject", {}).get("trigger") == "counting_claim"
        ]
        self.assertEqual(
            [row["subject"]["count_entity"] for row in count_rows],
            ["judges", "contestants"],
        )
        anchors = cv._source_anchor_catalog(source)

        def anchor_id(phrase):
            folded = cv._fold_evidence_text(phrase)
            return next(
                source_id for source_id, anchor in anchors.items()
                if folded in cv._fold_evidence_text(anchor["excerpt"])
            )

        judge_ids = [
            anchor_id("First judge takes the stage"),
            anchor_id("Second judge takes the stage"),
        ]
        contestant_ids = [
            anchor_id("First contestant takes the stage"),
            anchor_id("Second contestant takes the stage"),
        ]

        def typed_counts(source_ids_by_slot):
            return {"count_results": [
                {
                    "slot": row["slot"],
                    "instances": [
                        {
                            "source_id": source_id,
                            "matches_claim": True,
                            "multiplicity": 1,
                        }
                        for source_id in source_ids_by_slot[row["slot"]]
                    ],
                }
                for row in count_rows
                if row["slot"] in source_ids_by_slot
            ]}

        malformed_main = typed_detail_payload_for_rows(rows, source)
        for result in malformed_main["count_results"]:
            if result["slot"] in {row["slot"] for row in count_rows}:
                result.pop("instances")
        malformed_a = {
            "count_results": [
                {"slot": row["slot"], "instances": None}
                for row in count_rows
            ]
        }
        overlapping_b = typed_counts({
            row["slot"]: judge_ids for row in count_rows
        })
        store = new_store()

        with self.assertRaisesRegex(
            cv.CoverageContractError,
            "Typed detail recovery left invalid count ledgers",
        ):
            run_engine(
                store,
                FakeTransport([
                    (coverage, settled_usage()),
                    (audit, settled_usage()),
                    (malformed_main, settled_usage()),
                    (malformed_a, settled_usage()),
                    (overlapping_b, settled_usage()),
                ]),
                text=source,
            )

        progress_path = next(
            store.root.glob("*/audit_details_progress.json")
        )
        progress = json.loads(progress_path.read_text(encoding="utf-8"))[
            "payload"
        ]
        self.assertEqual(
            progress["typed_b_plan"], [count_rows[1]["slot"]]
        )
        self.assertEqual(progress["completed_typed_b_batches"], [])
        self.assertNotIn(
            count_rows[0]["slot"], progress["count_retry_feedback"]
        )
        self.assertIn(
            "overlaps an instance already used",
            progress["count_retry_feedback"][count_rows[1]["slot"]][
                "reason"
            ],
        )

        corrected = typed_counts({
            count_rows[1]["slot"]: contestant_ids,
        })
        resume = FakeTransport([
            (corrected, settled_usage()),
            RuntimeError("stop after count retry"),
        ])
        report, usage = run_engine(store, resume, text=source)

        self.assertEqual(len(resume.calls), 1)
        self.assertEqual(usage["call_count"], 1)
        self.assertEqual(report["status"], "sealed")
        self.assertTrue(resume.calls[0]["stage"].endswith("_typed_b"))
        completed = json.loads(
            progress_path.read_text(encoding="utf-8")
        )["payload"]
        self.assertEqual(len(completed["completed_typed_b_batches"]), 1)
        self.assertNotIn(
            count_rows[1]["slot"], completed["count_retry_feedback"]
        )

    def test_typed_b_checkpoints_wrong_group_candidate_and_exact_reason(self):
        coverage = valid_coverage()
        audit = provider_audit_core(coverage)
        normalized = cv.normalize_audit_tool_input(
            copy.deepcopy(audit), range(1, 7)
        )
        rows = cv.build_detail_audit_rows(
            coverage,
            cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT),
            normalized["sequence_ledger"],
        )
        target = next(
            row for row in rows
            if row["kind"] == "sequence_evidence"
            and "character_knowledge" in row["subject"]["required_fields"]
        )
        malformed_main = supported_detail_payload(
            coverage, normalized
        )
        malformed_main["results"][target["slot"]] = "supported"
        wrong_group = typed_detail_payload_for_rows([target])
        raw_candidate = wrong_group.pop("sequence_knowledge_results")[0]
        wrong_group["sequence_results"] = [copy.deepcopy(raw_candidate)]
        store = new_store()

        transport = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (malformed_main, settled_usage()),
            (wrong_group, settled_usage()),
        ])
        report, usage = run_engine(store, transport, max_calls=4)

        self.assertEqual(report["status"], "needs_review")
        self.assertEqual(usage["call_count"], 4)
        self.assertFalse(report["diagnostics"]["fact_repair"]["attempted"])
        unresolved = next(
            row for row in report["fact_audit"]["sequence_evidence"]
            if row["field_path"] == target["identifier"]
        )
        self.assertEqual(unresolved["classification"], "unclassified")
        self.assertEqual(unresolved["grounding_status"], "unresolved")
        self.assertFalse(unresolved["grounding_valid"])

        progress_path = next(
            store.root.glob("*/audit_details_progress.json")
        )
        progress = json.loads(progress_path.read_text(encoding="utf-8"))[
            "payload"
        ]
        feedback = progress["grounded_retry_feedback"][target["slot"]]
        self.assertEqual(
            feedback["reason"],
            "slot was returned in sequence_results, expected "
            "sequence_knowledge_results",
        )
        self.assertEqual(
            feedback["rejected_candidate"],
            {
                key: value for key, value in raw_candidate.items()
                if key != "slot"
            },
        )

    def test_typed_b_checkpoints_exact_count_transport_failures(self):
        coverage = valid_coverage()
        coverage["story_spine"]["opposition"] = (
            "Tony bribes a trio of judges."
        )
        audit = provider_audit_core(coverage)
        normalized = cv.normalize_audit_tool_input(
            copy.deepcopy(audit), range(1, 7)
        )
        rows = cv.build_detail_audit_rows(
            coverage,
            cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT),
            normalized["sequence_ledger"],
        )
        target = next(
            row for row in rows
            if row.get("subject", {}).get("trigger") == "counting_claim"
        )
        cases = [
            (None, "instances must be an array"),
            ([{
                "source_id": "p001-l001",
                "matches_claim": True,
            }], "instance 1 missing fields: multiplicity"),
            ([{
                "source_id": "p001-l001",
                "matches_claim": "yes",
                "multiplicity": 1,
            }], "instance 1 matches_claim must be boolean"),
            ([{
                "source_id": "p001-l001",
                "matches_claim": True,
                "multiplicity": 0,
            }], "instance 1 multiplicity must be an integer >= 1"),
        ]
        for instances, expected_reason in cases:
            with self.subTest(reason=expected_reason):
                malformed_main = supported_detail_payload(
                    coverage, normalized
                )
                malformed_main["results"][target["slot"]] = "supported"
                final = {"count_results": [{
                    "slot": target["slot"],
                    "instances": instances,
                }]}
                store = new_store()
                transport = FakeTransport([
                    (coverage, settled_usage()),
                    (audit, settled_usage()),
                    (malformed_main, settled_usage()),
                    (copy.deepcopy(final), settled_usage()),
                    (final, settled_usage()),
                ])
                report, usage = run_engine(store, transport, max_calls=5)
                self.assertEqual(report["status"], "needs_review")
                self.assertEqual(usage["call_count"], 5)
                self.assertFalse(
                    report["diagnostics"]["fact_repair"]["attempted"]
                )
                unresolved = next(
                    row
                    for row in report["fact_audit"][
                        "existing_evidence_verdicts"
                    ]
                    if row["field_path"] == target["identifier"]
                )
                self.assertEqual(
                    unresolved["classification"], "unclassified"
                )
                progress_path = next(
                    store.root.glob("*/audit_details_progress.json")
                )
                progress = json.loads(
                    progress_path.read_text(encoding="utf-8")
                )["payload"]
                feedback = progress["count_retry_feedback"][target["slot"]]
                self.assertEqual(feedback["reason"], expected_reason)
                self.assertEqual(
                    feedback["rejected_candidate"], {"instances": instances}
                )

    def test_all_malformed_counts_retry_in_one_schema_safe_typed_batch(self):
        coverage = valid_coverage()
        coverage["story_spine"].update({
            "opposition": "Two judges oppose Diego.",
            "stakes": "Three judges can take the field.",
            "climax": "Four judges confront Diego in the final.",
            "ending": "Five judges leave after the final.",
        })
        evidence = cv.build_existing_evidence_checks(
            coverage, SCREENPLAY_TEXT
        )
        count_rows = [
            row for row in cv.build_detail_audit_rows(coverage, evidence)
            if row["subject"].get("trigger") == "counting_claim"
        ]
        self.assertEqual(len(count_rows), 4)

        retry_payload = {
            "results": {
                row["slot"]: {
                        "classification": "unsupported",
                        "observed_total": 0,
                        "observed_universe_total": 0,
                        "instances": [],
                        "note": "No matching judges appear in the screenplay.",
                }
                for row in count_rows
            }
        }
        complete_audit = supported_audit(coverage)
        for beat in complete_audit["sequence_ledger"]:
            if beat["action"] != "NOT PRESENT":
                beat["action"] = "Diego completes the staged event."
        provider_audit = provider_audit_core(coverage)
        for beats in provider_audit["sequence_ledger"].values():
            for beat in beats:
                if beat["action"] != "NOT PRESENT":
                    beat["action"] = "Diego completes the staged event."
        transport = FakeTransport([
            (coverage, settled_usage()),
            (provider_audit, settled_usage()),
            (
                supported_detail_payload(coverage, complete_audit),
                settled_usage(),
            ),
            (retry_payload, settled_usage()),
        ])

        report, usage = run_engine(new_store(), transport)
        self.assertEqual(report["status"], "needs_review")
        self.assertEqual(usage["call_count"], 4)
        self.assertEqual(
            transport.calls[3]["stage"],
            "coverage_v1.fact_audit_details_typed_a",
        )
        count_schema = transport.calls[3]["tool"]["input_schema"][
            "properties"
        ]["count_results"]
        self.assertEqual(count_schema["minItems"], 4)
        self.assertEqual(count_schema["maxItems"], 4)

    def test_cosquillitas_count_ledger_requires_verbatim_instances(self):
        source = (
            "[PAGE 97]\nTony entrega dinero al primer juez y regala un reloj "
            "al segundo juez.\n"
        )
        rows = [{
            "slot": "row_001",
            "kind": "existing_evidence",
            "identifier": "story_spine.opposition",
            "subject": {
                "field_path": "story_spine.opposition",
                "trigger": "counting_claim",
                "claim": "Tony bribes three of the four contest judges",
            },
        }]
        payload = {
            "results": {
                "row_001": json.dumps({
                    "classification": "partially_supported",
                    "observed_total": 2,
                    "observed_universe_total": 2,
                    "instances": [
                        {
                            "label": "first judge",
                            "page": 97,
                            "excerpt": "entrega dinero al primer juez",
                            "matches_claim": True,
                        },
                        {
                            "label": "second judge",
                            "page": 97,
                            "excerpt": "regala un reloj al segundo juez",
                            "matches_claim": True,
                        },
                    ],
                    "note": "Two bribed judges are shown on page 97, not three.",
                })
            }
        }

        evidence, citations = cv.decode_detail_audit_payload(
            payload, rows, source
        )

        self.assertEqual(citations, [])
        self.assertEqual(evidence[0]["classification"], "partially_supported")
        self.assertTrue(evidence[0]["count_ledger"]["valid"])
        self.assertEqual(evidence[0]["count_ledger"]["observed_total"], 2)

    def test_count_ledger_rejects_reused_evidence_as_distinct_instances(self):
        source = "[PAGE 97]\nTony entrega dinero al primer juez.\n"
        claim = "Tony bribes three judges."
        rows = [{
            "slot": "row_001",
            "kind": "existing_evidence",
            "identifier": "story_spine.opposition",
            "subject": {
                "field_path": "story_spine.opposition",
                "trigger": "counting_claim",
                "claim": claim,
                **cv._material_count_claim_details(claim),
            },
        }]
        payload = {"results": {"row_001": {
            "classification": "supported",
            "observed_total": 3,
            "observed_universe_total": 3,
            "instances": [
                {
                    "label": f"judge {index}",
                    "page": 97,
                    "excerpt": "entrega dinero al primer juez",
                    "matches_claim": True,
                }
                for index in range(1, 4)
            ],
            "note": "Three judges are bribed.",
        }}}

        evidence, _citations = cv.decode_detail_audit_payload(
            payload, rows, source
        )

        self.assertEqual(evidence[0]["classification"], "unsupported")
        self.assertFalse(evidence[0]["count_ledger"]["valid"])
        self.assertIn("overlaps an evidence anchor", evidence[0]["note"])

    def test_count_ledger_rejects_shifted_quotes_from_one_event(self):
        source = "[PAGE 97]\nTony bribes the first judge at noon.\n"
        claim = "Tony bribes two judges."
        rows = [{
            "slot": "row_001",
            "kind": "existing_evidence",
            "identifier": "story_spine.opposition",
            "subject": {
                "field_path": "story_spine.opposition",
                "trigger": "counting_claim",
                "claim": claim,
                **cv._material_count_claim_details(claim),
            },
        }]
        payload = {"results": {"row_001": {
            "classification": "supported",
            "observed_total": 2,
            "observed_universe_total": 2,
            "instances": [
                {
                    "label": "first window",
                    "page": 97,
                    "excerpt": "Tony bribes the first judge",
                    "matches_claim": True,
                },
                {
                    "label": "shifted window",
                    "page": 97,
                    "excerpt": "bribes the first judge at noon",
                    "matches_claim": True,
                },
            ],
            "note": "Two judges are claimed from one event.",
        }}}

        evidence, _citations = cv.decode_detail_audit_payload(
            payload, rows, source
        )

        self.assertFalse(evidence[0]["count_ledger"]["valid"])
        self.assertIn("overlaps an evidence anchor", evidence[0]["note"])

    def test_collective_source_line_uses_one_multiplicity_instance(self):
        source = "[PAGE 94]\nThe first two judges raise their cards.\n"
        claim = "Two judges score ten."
        rows = [{
            "slot": "row_001",
            "kind": "existing_evidence",
            "identifier": "story_spine.climax",
            "subject": {
                "field_path": "story_spine.climax",
                "trigger": "counting_claim",
                "claim": claim,
                **cv._material_count_claim_details(claim),
            },
        }]
        payload = {"results": {"row_001": {
            "classification": "supported",
            "observed_total": 2,
            "observed_universe_total": 2,
            "instances": [{
                "label": "first two judges collectively",
                "page": 94,
                "excerpt": "The first two judges raise their cards",
                "matches_claim": True,
                "multiplicity": 2,
            }],
            "note": "One line explicitly identifies two judges.",
        }}}

        evidence, _citations = cv.decode_detail_audit_payload(
            payload, rows, source
        )

        self.assertTrue(evidence[0]["count_ledger"]["valid"])
        self.assertEqual(
            evidence[0]["count_ledger"]["instances"][0]["multiplicity"], 2
        )

    def test_global_count_uniqueness_survives_separate_retry_decode(self):
        source = (
            "[PAGE 7]\nFirst judge takes the stage. "
            "Second judge takes the stage.\n"
        )
        coverage = valid_coverage()
        coverage["story_spine"]["opposition"] = (
            "Two judges are bribed and two contestants perform."
        )
        rows = [
            row for row in cv.build_detail_audit_rows(
                coverage,
                cv.build_existing_evidence_checks(coverage, source),
            )
            if row["subject"].get("trigger") == "counting_claim"
        ]

        def payload_for(row):
            return {"results": {row["slot"]: {
                "classification": "supported",
                "observed_total": 2,
                "observed_universe_total": 2,
                "instances": [
                    {
                        "label": label,
                        "page": 7,
                        "excerpt": excerpt,
                        "matches_claim": True,
                    }
                    for label, excerpt in (
                        ("first", "First judge takes the stage"),
                        ("second", "Second judge takes the stage"),
                    )
                ],
                "note": "Two instances are claimed.",
            }}}

        first, _ = cv.decode_detail_audit_payload(
            payload_for(rows[0]), [rows[0]], source
        )
        retry, _ = cv.decode_detail_audit_payload(
            payload_for(rows[1]), [rows[1]], source
        )
        combined = cv._enforce_count_ledger_uniqueness(
            [*first, *retry], rows, source
        )

        self.assertTrue(combined[0]["count_ledger"]["valid"])
        self.assertFalse(combined[1]["count_ledger"]["valid"])
        self.assertEqual(
            combined[1]["rejected_candidate"]["instances"],
            retry[0]["count_ledger"]["instances"],
        )
        self.assertIn(
            "overlaps an instance already used",
            combined[1]["count_ledger"]["reason"],
        )

    def test_typed_count_ledger_decodes_without_free_form_json(self):
        source = "[PAGE 97]\nTony entrega dinero al primer juez.\n"
        rows = [{
            "slot": "row_001",
            "kind": "existing_evidence",
            "identifier": "story_spine.opposition",
            "subject": {
                "field_path": "story_spine.opposition",
                "trigger": "counting_claim",
                "claim": "Tony bribes one judge",
                "claimed_total": 1,
            },
        }]
        payload = {
            "results": {
                "row_001": {
                    "classification": "supported",
                    "observed_total": 1,
                    "observed_universe_total": 1,
                    "instances": [{
                        "label": "first judge",
                        "page": 97,
                        "excerpt": "entrega dinero al primer juez",
                        "matches_claim": True,
                    }],
                    "note": "One bribed judge is shown.",
                }
            }
        }

        evidence, citations = cv.decode_detail_audit_payload(
            payload, rows, source
        )

        self.assertEqual(citations, [])
        self.assertEqual(evidence[0]["classification"], "supported")
        self.assertTrue(evidence[0]["count_ledger"]["valid"])

        retry_rows = [
            {**rows[0], "slot": f"row_{index:03d}"}
            for index in range(1, 10)
        ]
        stats = cv.strict_schema_complexity(
            cv.build_detail_audit_tool(retry_rows)["input_schema"]
        )
        self.assertLessEqual(stats["property_count"], 44)
        self.assertLessEqual(stats["object_count"], 9)

    def test_ratio_count_cannot_hide_a_wrong_denominator(self):
        source = (
            "[PAGE 97]\nAna is the first judge. Beto is the second judge. "
            "Carla is the third judge. Diego is the fourth judge.\n"
        )
        subject = {
            "field_path": "story_spine.opposition",
            "trigger": "counting_claim",
            "claim": "Two of three judges are bribed.",
            **cv._material_count_claim_details(
                "Two of three judges are bribed."
            ),
        }
        rows = [{
            "slot": "row_001",
            "kind": "existing_evidence",
            "identifier": "story_spine.opposition",
            "subject": subject,
        }]
        instances = [
            {
                "label": label,
                "page": 97,
                "excerpt": excerpt,
                "matches_claim": index < 2,
            }
            for index, (label, excerpt) in enumerate((
                ("Ana", "Ana is the first judge"),
                ("Beto", "Beto is the second judge"),
                ("Carla", "Carla is the third judge"),
                ("Diego", "Diego is the fourth judge"),
            ))
        ]
        payload = {"results": {"row_001": {
            "classification": "supported",
            "observed_total": 2,
            "observed_universe_total": 4,
            "instances": instances,
            "note": "Two are bribed, but four judges appear.",
        }}}

        evidence, _citations = cv.decode_detail_audit_payload(
            payload, rows, source
        )

        self.assertEqual(evidence[0]["classification"], "unsupported")
        self.assertFalse(evidence[0]["count_ledger"]["valid"])
        self.assertIn("universe total", evidence[0]["note"])

    def test_minimum_ratio_accepts_more_matching_instances(self):
        source = (
            "[PAGE 97]\nAna is the first judge. Beto is the second judge. "
            "Carla is the third judge. Diego is the fourth judge.\n"
        )
        claim = "At least two of four judges are bribed."
        rows = [{
            "slot": "row_001",
            "kind": "existing_evidence",
            "identifier": "story_spine.opposition",
            "subject": {
                "field_path": "story_spine.opposition",
                "trigger": "counting_claim",
                "claim": claim,
                **cv._material_count_claim_details(claim),
            },
        }]
        instances = [
            {
                "label": label,
                "page": 97,
                "excerpt": excerpt,
                "matches_claim": index < 3,
            }
            for index, (label, excerpt) in enumerate((
                ("Ana", "Ana is the first judge"),
                ("Beto", "Beto is the second judge"),
                ("Carla", "Carla is the third judge"),
                ("Diego", "Diego is the fourth judge"),
            ))
        ]
        payload = {"results": {"row_001": {
            "classification": "supported",
            "observed_total": 3,
            "observed_universe_total": 4,
            "instances": instances,
            "note": "Three of the four judges are bribed.",
        }}}

        evidence, _citations = cv.decode_detail_audit_payload(
            payload, rows, source
        )

        self.assertEqual(evidence[0]["classification"], "supported")
        self.assertTrue(evidence[0]["count_ledger"]["valid"])
        self.assertEqual(
            evidence[0]["count_ledger"]["count_quantifier"], "minimum"
        )

    def test_two_or_three_range_accepts_three_source_instances(self):
        source = (
            "[PAGE 97]\nAna accepts cash. Beto accepts a watch. "
            "Carla accepts a suitcase.\n"
        )
        claim = "Tony bribes two or three judges."
        subject = {
            "field_path": "story_spine.opposition",
            "trigger": "counting_claim",
            "claim": claim,
            **cv._material_count_claim_details(claim),
        }
        row = {
            "slot": "row_001",
            "kind": "existing_evidence",
            "identifier": "story_spine.opposition",
            "subject": subject,
        }
        instances = [
            {
                "label": name,
                "page": 97,
                "excerpt": excerpt,
                "matches_claim": True,
            }
            for name, excerpt in (
                ("Ana", "Ana accepts cash"),
                ("Beto", "Beto accepts a watch"),
                ("Carla", "Carla accepts a suitcase"),
            )
        ]
        payload = {"results": {"row_001": {
            "classification": "supported",
            "observed_total": 3,
            "observed_universe_total": 3,
            "instances": instances,
            "note": "Three judges accept bribes.",
        }}}

        evidence, _citations = cv.decode_detail_audit_payload(
            payload, [row], source
        )

        ledger = evidence[0]["count_ledger"]
        self.assertEqual(evidence[0]["classification"], "supported")
        self.assertEqual(ledger["count_quantifier"], "range")
        self.assertEqual(ledger["claimed_total"], 2)
        self.assertEqual(ledger["claimed_max_total"], 3)

    def test_will_sequence_ledger_rejects_nonliteral_order_metadata(self):
        coverage = valid_coverage()
        audit = supported_audit(coverage)
        audit["sequence_ledger"][0]["order"] = 2
        audit["sequence_ledger"][1]["order"] = 1
        checks = cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT)
        page_map = cv.build_page_reference_map(SCREENPLAY_TEXT, 6, None)

        problems = cv.validate_audit_payload(
            audit,
            cv.build_audit_claims(coverage),
            coverage,
            page_map,
            checks,
        )

        self.assertIn(
            "sequence_ledger order must be consecutive from 1",
            problems,
        )

    def test_cosquillitas_sequence_ledger_rejects_descending_pages(self):
        coverage = valid_coverage()
        audit = supported_audit(coverage)
        audit["sequence_ledger"][0]["page"] = 6
        audit["sequence_ledger"][1]["page"] = 5

        problems = cv.validate_audit_payload(
            audit,
            cv.build_audit_claims(coverage),
            coverage,
            cv.build_page_reference_map(SCREENPLAY_TEXT, 6, None),
            cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT),
        )

        self.assertIn(
            "sequence_ledger pages must be nondecreasing in literal story order",
            problems,
        )

    def test_sequence_ledger_requires_an_explicit_ending_phase(self):
        coverage = valid_coverage()
        audit = supported_audit(coverage)
        audit["sequence_ledger"] = [
            row for row in audit["sequence_ledger"]
            if row["phase"] != "ending"
        ]
        for order, row in enumerate(audit["sequence_ledger"], start=1):
            row["order"] = order

        problems = cv.validate_audit_payload(
            audit,
            cv.build_audit_claims(coverage),
            coverage,
            cv.build_page_reference_map(SCREENPLAY_TEXT, 6, None),
            cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT),
        )

        self.assertIn("sequence_ledger missing ending phase", problems)

    def test_contradicted_central_fact_needs_review_not_rerun(self):
        coverage = valid_coverage()
        audit = supported_audit(coverage)
        for verdict in audit["verdicts"]:
            if verdict["claim_id"] == "spine.ending":
                verdict["classification"] = "contradicted"
                verdict["note"] = "Diego muere en la página 6."
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (audit, settled_usage()),
            ]
        )
        report, _usage = run_engine(new_store(), transport)
        self.assertEqual(len(transport.calls), 2)
        self.assertEqual(report["status"], "needs_review")
        self.assertTrue(report["human_review_recommended"])
        self.assertIn("spine.ending", report["fact_audit"]["central_failures"])
        self.assertEqual(cv.trust_labels(report)["story_spine"], "UNRESOLVED")

    def test_sequence_guard_partial_never_triggers_whole_report_repair(self):
        by_claim = {
            "guard.sequence_integrity": {
                "claim_id": "guard.sequence_integrity",
                "classification": "partially_supported",
            }
        }

        self.assertEqual(cv._fact_repair_targets(by_claim, {}, []), [])

    def test_will_reversed_climax_order_cannot_seal(self):
        coverage = valid_coverage()
        coverage["story_spine"]["climax"] = (
            "God stops Eric, then Angela is freed and chooses Will"
        )
        audit = supported_audit(coverage)
        for row in audit["verdicts"]:
            if row["claim_id"] == "guard.sequence_integrity":
                row["classification"] = "contradicted"
                row["note"] = (
                    "Angela says yes under active puppeting before God's order."
                )
        transport = FakeTransport(
            [(coverage, settled_usage()), (audit, settled_usage())]
        )

        report, _usage = run_engine(new_store(), transport)

        self.assertEqual(report["status"], "needs_review")
        self.assertIn(
            "guard.sequence_integrity",
            report["fact_audit"]["central_failures"],
        )

    def test_el_arbol_inconsistent_ending_cannot_seal(self):
        coverage = valid_coverage()
        coverage["story_spine"]["ending"] = (
            "The boxes hold photographs instead of living followers"
        )
        coverage["synopsis"] = coverage["synopsis"] + (
            " Living followers are burned inside the boxes to heal loved ones."
        )
        audit = supported_audit(coverage)
        for row in audit["verdicts"]:
            if row["claim_id"] == "guard.cross_field_consistency":
                row["classification"] = "contradicted"
                row["note"] = "The ending and synopsis describe opposite victims."
        transport = FakeTransport(
            [(coverage, settled_usage()), (audit, settled_usage())]
        )

        report, _usage = run_engine(new_store(), transport)

        self.assertEqual(report["status"], "needs_review")
        self.assertIn(
            "guard.cross_field_consistency",
            report["fact_audit"]["central_failures"],
        )

    def test_will_fact_repair_propagates_one_climax_to_every_section(self):
        source = SCREENPLAY_TEXT.replace(
            "[PAGE 6]",
            """[PAGE 6]
Angela says yes under puppeting before God's order.
The audience watches as Angela says yes under puppeting before God's order.
Angela knows she said yes under puppeting.""",
        )
        coverage = valid_coverage()
        wrong = "God frees Angela before she says yes"
        corrected_fact = "Angela says yes under puppeting before God's order"
        coverage["story_spine"]["climax"] = wrong
        coverage["synopsis"] += " " + wrong + "."
        coverage["lens_notes"][0]["analysis"] = (
            "The climax appears externally resolved because " + wrong + ", "
            "which weakens the character decision despite the strong setup."
        )
        coverage["concerns"][0]["point"] = wrong + " and removes her agency"
        coverage["development_priorities"][0]["how"] = (
            "Reverse the order so Angela chooses before divine intervention"
        )
        coverage["uncertainties"] = [wrong]
        coverage["champion_reason"] = wrong + ", but the romance still lands"
        coverage["pass_reason"] = wrong + ", so the climax feels unearned"
        corrected = copy.deepcopy(coverage)
        for path in (
            ("story_spine", "climax"),
            ("synopsis",),
            ("champion_reason",),
            ("pass_reason",),
        ):
            target = corrected
            for segment in path[:-1]:
                target = target[segment]
            target[path[-1]] = str(target[path[-1]]).replace(wrong, corrected_fact)
        corrected["lens_notes"][0]["analysis"] = corrected_fact + (
            ", preserving her agency while the later order stops the kill threat."
        )
        corrected["concerns"][0]["point"] = (
            "God's later order resolves the separate kill threat externally"
        )
        corrected["development_priorities"][0]["how"] = (
            "Clarify that Angela chooses before the later divine order"
        )
        corrected["uncertainties"] = [
            "Whether the later rescue from the kill threat feels external"
        ]
        audit = supported_audit(coverage)
        ground_sequence_row_for_test(
            audit["sequence_ledger"][0],
            page=6,
            actor="Angela",
            action=corrected_fact,
            knowledge="Angela knows she said yes under puppeting.",
            audience=(
                "The audience watches as Angela says yes under puppeting "
                "before God's order."
            ),
        )
        for row in audit["verdicts"]:
            if row["claim_id"] == "guard.cross_field_consistency":
                row["classification"] = "partially_supported"
                row["note"] = "The report reverses Angela's decisive action."
        audit = completed_audit_fixture(coverage, audit, source)
        corrected_audit = supported_audit(corrected)
        ground_sequence_row_for_test(
            corrected_audit["sequence_ledger"][0],
            page=6,
            actor="Angela",
            action=corrected_fact,
            knowledge="Angela knows she said yes under puppeting.",
            audience=(
                "The audience watches as Angela says yes under puppeting "
                "before God's order."
            ),
        )
        corrected_audit = completed_audit_fixture(
            corrected, corrected_audit, source
        )
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (audit, settled_usage()),
                (corrected, settled_usage()),
                (corrected_audit, settled_usage()),
            ]
        )

        report, _usage = run_engine(new_store(), transport, text=source)

        self.assertEqual(report["status"], "sealed")
        self.assertNotIn(wrong, json.dumps(report["coverage"]))
        self.assertEqual(
            report["diagnostics"]["canonical_fact_registry"]["climax"],
            corrected_fact,
        )

    def test_reveal_repair_propagates_source_without_inventing_activation(self):
        text = SCREENPLAY_TEXT.replace(
            "[PAGE 3]",
            "A hidden camera records the room.\n[PAGE 3]",
        ).replace(
            "[PAGE 4]",
            "A teammate learns the bribe and keeps access.\n[PAGE 4]",
        ).replace(
            "[PAGE 6]",
            "The camera footage appears on the stadium screen.\n[PAGE 6]",
        ) + "\nThe private footage continues after the reveal.\n"
        wrong = (
            "The reveal has no camera, source, or character motive anywhere "
            "in the screenplay."
        )
        coverage = valid_coverage()
        coverage["genre_contract"]["failures"] = [wrong]
        coverage["concerns"][0] = {
            "point": wrong,
            "page": 2,
            "excerpt": "A hidden camera records",
        }
        coverage["development_priorities"][0] = {
            "priority": "Add a brand-new camera before the reveal",
            "why": wrong,
            "how": "Create a new scene that plants and activates it",
        }
        coverage["uncertainties"] = [wrong]
        coverage["pass_reason"] = wrong

        checks = cv.build_existing_evidence_checks(coverage, text)
        audit = supported_audit(coverage)
        audit["existing_evidence_verdicts"] = [
            {
                "field_path": check["field_path"],
                "classification": (
                    "contradicted"
                    if check["source_field_path"] in {
                        "genre_contract.failures[0]",
                        "concerns[0].point",
                        "development_priorities[0]",
                        "uncertainties[0]",
                        "pass_reason",
                    }
                    else "supported"
                ),
                "note": (
                    "source_device=p.2; motive_access=p.3; reveal=p.5; "
                    "provenance_aftermath=p.6: source and motive exist, but "
                    "activation is not established."
                ),
            }
            for check in checks
        ]
        next(
            row for row in audit["verdicts"]
            if row["claim_id"] == "guard.existing_evidence"
        )["classification"] = "contradicted"

        corrected = copy.deepcopy(coverage)
        safe = (
            "The footage source and character access are inferable, while "
            "the activation of the final playback remains unconfirmed."
        )
        corrected["genre_contract"]["failures"] = [safe]
        corrected["concerns"][0]["point"] = safe
        corrected["development_priorities"][0] = {
            "priority": "Clarify who activates the existing camera footage",
            "why": "The source exists, but the final delivery remains unclear",
            "how": "Connect the established access to the playback action",
        }
        corrected["uncertainties"] = [safe]
        corrected["pass_reason"] = safe
        reaudited = supported_audit(corrected)
        reaudited["existing_evidence_verdicts"] = [
            {
                "field_path": check["field_path"],
                "classification": "supported",
                "note": "The corrected wording matches the screenplay.",
            }
            for check in cv.build_existing_evidence_checks(corrected, text)
        ]
        transport = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (corrected, settled_usage()),
            (reaudited, settled_usage()),
        ])

        report, _usage = run_engine(
            new_store(),
            transport,
            text=text,
            content_sha256="b" * 64,
        )

        self.assertEqual(report["status"], "sealed")
        serialized = json.dumps(report["coverage"])
        self.assertNotIn("no camera", serialized)
        for field in (
            report["coverage"]["genre_contract"]["failures"][0],
            report["coverage"]["concerns"][0]["point"],
            report["coverage"]["uncertainties"][0],
            report["coverage"]["pass_reason"],
        ):
            self.assertIn("activation", field)
            self.assertIn("unconfirmed", field)
        priority = report["coverage"]["development_priorities"][0]
        self.assertIn("existing camera", priority["priority"])
        self.assertNotIn("brand-new", json.dumps(priority))

    def test_incomplete_audit_retries_once_on_coverage_model(self):
        coverage = valid_coverage()
        bad_audit = supported_audit(coverage)
        bad_audit["verdicts"].pop()
        good_audit = supported_audit(coverage)
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (bad_audit, settled_usage()),
                (good_audit, settled_usage(120_000)),
            ]
        )
        report, usage = run_engine(new_store(), transport)
        self.assertEqual(len(transport.calls), 3)
        # The retry runs on the coverage-tier model, not the cheap auditor.
        self.assertEqual(transport.calls[1]["model_key"], "haiku")
        self.assertEqual(transport.calls[2]["model_key"], "sonnet")
        self.assertEqual(report["status"], "sealed")
        self.assertEqual(report["models"]["audit_effective"], "sonnet")
        self.assertEqual(report["cost"]["repair_calls_used"], 1)
        self.assertTrue(report["diagnostics"]["audit_first_pass_problems"])
        retry_prompt = str(transport.calls[2]["user_blocks"][-1]["text"])
        self.assertIn("PRIOR OUTPUT REJECTED", retry_prompt)
        self.assertIn("audit did not classify", retry_prompt)

    def test_persistently_missing_noncentral_verdict_needs_review(self):
        # Live failure 2026-09-01: the auditor skipped one non-central claim
        # twice and destroyed a $0.73 run. Now the missing id becomes an
        # explicit 'unclassified' verdict: sealed, review-flagged, excluded
        # from support_rate — never a fabricated classification.
        coverage = valid_coverage()
        bad_audit = supported_audit(coverage)
        bad_audit["verdicts"] = [
            row
            for row in bad_audit["verdicts"]
            if row["claim_id"] != "pass_reason"
        ]
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (bad_audit, settled_usage()),
                (bad_audit, settled_usage()),
            ]
        )
        report, _usage = run_engine(new_store(), transport)
        self.assertEqual(len(transport.calls), 3)
        self.assertEqual(report["status"], "needs_review")
        self.assertTrue(report["human_review_recommended"])
        self.assertTrue(
            any("unclassified" in r for r in report["review_reasons"])
        )
        rows = {
            v["claim_id"]: v["classification"]
            for v in report["fact_audit"]["verdicts"]
        }
        self.assertEqual(rows["pass_reason"], "unclassified")
        self.assertEqual(report["fact_audit"]["support_rate"], 1.0)

    def test_persistently_missing_central_verdict_blocks_seal(self):
        coverage = valid_coverage()
        bad_audit = supported_audit(coverage)
        bad_audit["verdicts"] = [
            v
            for v in bad_audit["verdicts"]
            if v["claim_id"] != "spine.ending"
        ]
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (bad_audit, settled_usage()),
                (bad_audit, settled_usage()),
            ]
        )
        report, _usage = run_engine(new_store(), transport)
        self.assertEqual(report["status"], "needs_review")
        self.assertTrue(
            any(
                "central claims unclassified" in r
                for r in report["review_reasons"]
            )
        )

    def test_audit_retries_after_coverage_repair_then_fails_closed(self):
        broken = valid_coverage()
        del broken["development_priorities"]
        fixed = valid_coverage()
        bad_audit = supported_audit(fixed)
        bad_audit["verdicts"] = [
            row
            for row in bad_audit["verdicts"]
            if row["claim_id"] != "pass_reason"
        ]
        transport = FakeTransport(
            [
                (broken, settled_usage()),
                (fixed, settled_usage()),
                (bad_audit, settled_usage()),
                (bad_audit, settled_usage()),
            ]
        )
        report, _usage = run_engine(new_store(), transport)
        self.assertEqual(len(transport.calls), 4)
        self.assertEqual(report["status"], "needs_review")
        self.assertTrue(report["human_review_recommended"])
        self.assertEqual(report["cost"]["coverage_repair_calls_used"], 1)
        self.assertEqual(report["cost"]["audit_retry_calls_used"], 1)

    def test_central_partial_is_fact_repaired_and_reaudited(self):
        # Brief #3, defect 6: an audit-identified factual imprecision in a
        # central claim is rewritten per the note and re-audited before
        # sealing — never sealed with the error and its proof both intact.
        coverage = valid_coverage()
        audit = supported_audit(coverage)
        audit["verdicts"][0]["classification"] = "partially_supported"
        audit["verdicts"][0]["note"] = (
            "Diego tiene 58 años pero el guion nunca lo llama 'legendario'."
        )
        corrected = copy.deepcopy(coverage)
        corrected["story_spine"]["protagonist"] = (
            "Diego Salas, un portero retirado de 58 años"
        )
        corrected["synopsis"] = corrected["synopsis"].replace(
            "portero legendario venido a menos",
            "portero retirado venido a menos",
        )
        corrected["lens_notes"][0]["analysis"] = (
            "Bajo esta lente, Diego funciona como portero retirado de 58 años; "
            "la progresión dramática culmina con una decisión física bien ganada."
        )
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (audit, settled_usage()),
                (corrected, settled_usage()),
                (supported_audit(corrected), settled_usage()),
            ]
        )
        report, usage = run_engine(new_store(), transport)
        self.assertEqual(report["status"], "sealed")
        self.assertEqual(len(transport.calls), 4)
        self.assertEqual(
            report["coverage"]["story_spine"]["protagonist"],
            "Diego Salas, un portero retirado de 58 años",
        )
        self.assertIn("portero retirado venido a menos", report["coverage"]["synopsis"])
        self.assertIn("portero retirado", report["coverage"]["lens_notes"][0]["analysis"])
        self.assertEqual(report["fact_audit"]["support_rate"], 1.0)
        self.assertFalse(report["human_review_recommended"])
        info = report["diagnostics"]["fact_repair"]
        self.assertTrue(info["attempted"])
        self.assertEqual(info["applied"], ["spine.protagonist"])
        self.assertTrue(info["reaudited"])
        # The fact-repair call receives the complete report for propagation,
        # but never resends the screenplay itself.
        fact_call = transport.calls[2]
        blocks = fact_call["user_blocks"]
        self.assertFalse(
            any("SCREENPLAY TEXT" in str(b.get("text", "")) for b in blocks)
        )

    def test_fact_repair_cannot_change_undisputed_verdict(self):
        coverage = valid_coverage()
        audit = supported_audit(coverage)
        audit["verdicts"][0]["classification"] = "partially_supported"
        audit["verdicts"][0]["note"] = "The fame claim is overstated."
        corrected = copy.deepcopy(coverage)
        corrected["story_spine"]["protagonist"] = (
            "Diego Salas, portero retirado"
        )
        corrected["verdict"] = "RECOMMEND"
        transport = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (corrected, settled_usage()),
        ])

        report, _usage = run_engine(new_store(), transport)

        self.assertEqual(report["status"], "needs_review")
        self.assertEqual(report["verdict"], "CONSIDER")
        self.assertEqual(report["coverage"]["verdict"], "CONSIDER")
        self.assertEqual(
            report["diagnostics"]["fact_repair"]["applied"], []
        )
        self.assertIn(
            "protected qualitative field verdict",
            report["diagnostics"]["fact_repair"]["outcome"],
        )
        self.assertEqual(len(transport.calls), 3)

    def test_fact_repair_also_corrects_known_noncentral_partials(self):
        coverage = valid_coverage()
        coverage["genre_contract"]["failures"] = [
            "Pages 3-4 are entirely event-free."
        ]
        audit = supported_audit(coverage)
        for verdict in audit["verdicts"]:
            if verdict["claim_id"] == "spine.protagonist":
                verdict["classification"] = "partially_supported"
                verdict["note"] = "The protagonist description overstates his fame."
            if verdict["claim_id"] == "genre_contract.failure_0":
                verdict["classification"] = "partially_supported"
                verdict["note"] = "Page 4 contains a material event."
        corrected = copy.deepcopy(coverage)
        corrected["story_spine"]["protagonist"] = "Diego Salas, portero retirado"
        corrected["genre_contract"]["failures"] = [
            "Pages 3-4 lose momentum despite a material event on page 4."
        ]
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (audit, settled_usage()),
                (corrected, settled_usage()),
                (supported_audit(corrected), settled_usage()),
            ]
        )

        report, _usage = run_engine(new_store(), transport)

        expected = ["genre_contract.failure_0", "spine.protagonist"]
        self.assertEqual(report["status"], "sealed")
        self.assertEqual(
            report["diagnostics"]["fact_repair"]["target_claims"], expected
        )
        self.assertEqual(report["diagnostics"]["fact_repair"]["applied"], expected)
        repair_text = "\n".join(
            str(block.get("text", ""))
            for block in transport.calls[2]["user_blocks"]
        )
        self.assertIn("genre_contract.failure_0", repair_text)

    def test_stale_logline_or_commercial_fact_after_repair_cannot_seal(self):
        coverage = valid_coverage()
        old_fact = "Los Chavos fabricate three scandal videos."
        coverage["story_spine"]["opposition"] = old_fact
        coverage["logline"] = (
            "A retired goalkeeper fights Los Chavos, who fabricate three "
            "scandal videos, to save his neighborhood team and its field."
        )
        coverage["commercial_hypothesis"] = (
            "A family sports drama built around Los Chavos fabricating three "
            "scandal videos."
        )
        audit = supported_audit(coverage)
        opposition = next(
            row for row in audit["verdicts"]
            if row["claim_id"] == "spine.opposition"
        )
        opposition["classification"] = "partially_supported"
        opposition["note"] = (
            "Dante and Tony are implicated, but the initiator is unstated."
        )
        corrected = copy.deepcopy(coverage)
        corrected["story_spine"]["opposition"] = (
            "Dante and Tony are implicated in the videos; the initiator is "
            "not stated."
        )
        reaudited = supported_audit(corrected)
        consistency = next(
            row for row in reaudited["verdicts"]
            if row["claim_id"] == "guard.cross_field_consistency"
        )
        consistency["classification"] = "contradicted"
        consistency["note"] = (
            "The logline and commercial hypothesis retain the obsolete fact."
        )
        transport = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (corrected, settled_usage()),
            (reaudited, settled_usage()),
        ])

        report, _usage = run_engine(new_store(), transport)

        self.assertEqual(report["status"], "needs_review")
        self.assertIn(
            "guard.cross_field_consistency",
            report["fact_audit"]["central_failures"],
        )

    def test_noncentral_partial_alone_is_repaired_before_sealing(self):
        coverage = valid_coverage()
        coverage["genre_contract"]["failures"] = [
            "Pages 3-4 are entirely event-free."
        ]
        audit = supported_audit(coverage)
        failure = next(
            row for row in audit["verdicts"]
            if row["claim_id"] == "genre_contract.failure_0"
        )
        failure["classification"] = "partially_supported"
        failure["note"] = "Page 4 contains a material event."
        corrected = copy.deepcopy(coverage)
        corrected["genre_contract"]["failures"] = [
            "Pages 3-4 lose momentum despite a material event on page 4."
        ]
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (audit, settled_usage()),
                (corrected, settled_usage()),
                (supported_audit(corrected), settled_usage()),
            ]
        )

        report, _usage = run_engine(new_store(), transport)

        self.assertEqual(report["status"], "sealed")
        self.assertEqual(
            report["diagnostics"]["fact_repair"]["target_claims"],
            ["genre_contract.failure_0"],
        )

    def test_shifted_noncentral_partial_cannot_evade_reaudit(self):
        coverage = valid_coverage()
        coverage["genre_contract"]["failures"] = ["A factual overstatement."]
        audit = supported_audit(coverage)
        failure = next(
            row for row in audit["verdicts"]
            if row["claim_id"] == "genre_contract.failure_0"
        )
        failure["classification"] = "partially_supported"
        failure["note"] = "The statement remains too absolute."
        corrected = copy.deepcopy(coverage)
        corrected["genre_contract"]["failures"] = [
            "A new supported observation.",
            "The same unresolved factual overstatement.",
        ]
        reaudited = supported_audit(corrected)
        shifted = next(
            row for row in reaudited["verdicts"]
            if row["claim_id"] == "genre_contract.failure_1"
        )
        shifted["classification"] = "partially_supported"
        shifted["note"] = "The shifted statement is still too absolute."
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (audit, settled_usage()),
                (corrected, settled_usage()),
                (reaudited, settled_usage()),
            ]
        )

        report, _usage = run_engine(new_store(), transport)

        self.assertEqual(report["status"], "needs_review")
        self.assertEqual(report["diagnostics"]["fact_repair"]["applied"], [])
        self.assertIn(
            "genre_contract.failure_1",
            report["diagnostics"]["fact_repair"]["outcome"],
        )

    def test_fact_repair_candidate_resumes_without_rebuying_repair(self):
        coverage = valid_coverage()
        audit = supported_audit(coverage)
        audit["verdicts"][0]["classification"] = "partially_supported"
        audit["verdicts"][0]["note"] = "The fame claim is overstated."
        corrected = copy.deepcopy(coverage)
        corrected["story_spine"]["protagonist"] = "Diego Salas, portero retirado"
        store = new_store()
        first = FakeTransport(
            [
                (coverage, settled_usage()),
                (audit, settled_usage()),
                (corrected, settled_usage()),
                RuntimeError("proxy died during fact re-audit"),
            ]
        )

        with self.assertRaises(RuntimeError):
            run_engine(store, first)

        resume = FakeTransport(
            [(supported_audit(corrected), settled_usage())]
        )
        report, usage = run_engine(store, resume)

        self.assertEqual(len(resume.calls), 1)
        self.assertEqual(resume.calls[0]["stage"], "coverage_v1.fact_reaudit")
        self.assertEqual(usage["call_count"], 1)
        self.assertTrue(
            report["diagnostics"]["fact_repair"]["candidate_replayed"]
        )
        self.assertEqual(report["status"], "sealed")

    def test_valid_noop_fact_repair_is_not_rebought_on_resume(self):
        coverage = valid_coverage()
        audit = supported_audit(coverage)
        audit["verdicts"][0]["classification"] = "partially_supported"
        audit["verdicts"][0]["note"] = "The wording remains imprecise."
        store = new_store()
        first = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (coverage, settled_usage()),
        ])

        first_report, _usage = run_engine(store, first)
        resume = FakeTransport([])
        resumed_report, resumed_usage = run_engine(store, resume)

        self.assertEqual(first_report["status"], "needs_review")
        self.assertEqual(resumed_report["status"], "needs_review")
        self.assertEqual(len(resume.calls), 0)
        self.assertEqual(resumed_usage["call_count"], 0)
        self.assertTrue(
            resumed_report["diagnostics"]["fact_repair"][
                "candidate_replayed"
            ]
        )

    def test_fact_reaudit_core_resumes_at_details_without_rebuying_core(self):
        coverage = valid_coverage()
        audit = provider_audit_core(coverage)
        audit["verdicts"][0]["classification"] = "partially_supported"
        audit["verdicts"][0]["note"] = "The fame claim is overstated."
        normalized_audit = cv.normalize_audit_tool_input(
            copy.deepcopy(audit), range(1, 7)
        )
        corrected = copy.deepcopy(coverage)
        corrected["story_spine"]["protagonist"] = (
            "Diego Salas, portero retirado de 58 años"
        )
        corrected["concerns"][0]["point"] = (
            "The final sequence needs clearer dramatic emphasis."
        )
        corrected_rows = cv.build_detail_audit_rows(
            corrected,
            cv.build_existing_evidence_checks(corrected, SCREENPLAY_TEXT),
            normalized_audit["sequence_ledger"],
        )
        _seeded_evidence, _seeded_citations, pending_rows = (
            cv._reusable_detail_seed(
                coverage,
                cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT),
                completed_audit_fixture(coverage, normalized_audit),
                corrected_rows,
            )
        )
        pending_detail = detail_payload_for_rows(pending_rows)
        store = new_store()
        first = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (
                supported_detail_payload(coverage, normalized_audit),
                settled_usage(),
            ),
            (corrected, settled_usage()),
            (provider_audit_core(corrected), settled_usage()),
            RuntimeError("proxy died during fact re-audit details"),
        ])

        with self.assertRaises(RuntimeError):
            run_engine(store, first)

        resume = FakeTransport([
            (pending_detail, settled_usage()),
        ])
        report, usage = run_engine(store, resume)

        self.assertEqual(len(resume.calls), 1)
        self.assertEqual(
            resume.calls[0]["stage"],
            "coverage_v1.fact_reaudit_details",
        )
        self.assertEqual(usage["call_count"], 1)
        self.assertEqual(report["status"], "sealed")

    def test_partial_surviving_reaudit_needs_review(self):
        # A central factual partial that survives repair cannot seal trusted.
        coverage = valid_coverage()
        audit = supported_audit(coverage)
        audit["verdicts"][0]["classification"] = "partially_supported"
        corrected = copy.deepcopy(coverage)
        corrected["story_spine"]["protagonist"] = (
            "Diego Salas, portero retirado, 58"
        )
        still_partial = supported_audit(corrected)
        still_partial["verdicts"][0]["classification"] = "partially_supported"
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (audit, settled_usage()),
                (corrected, settled_usage()),
                (still_partial, settled_usage()),
            ]
        )
        report, _usage = run_engine(new_store(), transport)
        self.assertEqual(report["status"], "needs_review")
        self.assertTrue(report["human_review_recommended"])
        self.assertLess(report["fact_audit"]["support_rate"], 1.0)

    def test_contradiction_after_fact_repair_blocks_the_seal(self):
        coverage = valid_coverage()
        audit = supported_audit(coverage)
        audit["verdicts"][0]["classification"] = "partially_supported"
        corrected = copy.deepcopy(coverage)
        corrected["story_spine"]["protagonist"] = (
            "Un protagonista completamente distinto"
        )
        contradicted = supported_audit(corrected)
        contradicted["verdicts"][0]["classification"] = "contradicted"
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (audit, settled_usage()),
                (corrected, settled_usage()),
                (contradicted, settled_usage()),
            ]
        )
        report, _usage = run_engine(new_store(), transport)
        self.assertEqual(report["status"], "needs_review")

    def test_contradicted_central_fact_never_triggers_fact_repair(self):
        # A fundamentally wrong read goes to human review, not a patch.
        coverage = valid_coverage()
        audit = supported_audit(coverage)
        audit["verdicts"][0]["classification"] = "contradicted"
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (audit, settled_usage()),
            ]
        )
        report, _usage = run_engine(new_store(), transport)
        self.assertEqual(report["status"], "needs_review")
        self.assertEqual(len(transport.calls), 2)

    def test_focused_evidence_contradiction_is_a_repair_target(self):
        coverage = valid_coverage()
        checks = cv.build_existing_evidence_checks(
            coverage, SCREENPLAY_TEXT
        )
        target = next(
            row for row in checks
            if row["trigger"] in {"absolute_negative", "recommendation"}
        )
        audit = supported_audit(coverage)
        audit["existing_evidence_verdicts"] = [{
            "field_path": target["field_path"],
            "classification": "unsupported",
            "note": (
                "FOCUSED_EVIDENCE_CONTRADICTION: existing setup was found"
            ),
        }]
        by_claim = {
            row["claim_id"]: row for row in audit["verdicts"]
        }
        by_claim["guard.existing_evidence"]["classification"] = (
            "unsupported"
        )

        targets = cv._fact_repair_targets(by_claim, audit, checks)

        self.assertIn("guard.existing_evidence", targets)

    def test_fact_repair_gets_one_targeted_citation_scope_retry(self):
        coverage = valid_coverage()
        audit = supported_audit(coverage)
        audit["verdicts"][0]["classification"] = "partially_supported"
        audit["verdicts"][0]["note"] = "The protagonist wording is vague."
        corrected = copy.deepcopy(coverage)
        corrected["story_spine"]["protagonist"] = (
            "Diego Salas, retired goalkeeper"
        )
        corrected["concerns"][0]["point"] = (
            "On p.4, Román Vega threatens the field, but no motive is "
            "established anywhere in the screenplay."
        )
        scope_fixed = copy.deepcopy(corrected)
        scope_fixed["concerns"][0]["point"] = (
            "On p.4, Román Vega threatens the field. The screenplay never "
            "establishes a personal motive for him."
        )
        transport = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (corrected, settled_usage()),
            (scope_fixed, settled_usage()),
            (supported_audit(scope_fixed), settled_usage()),
        ])

        report, _usage = run_engine(new_store(), transport)

        self.assertEqual(report["status"], "sealed")
        self.assertEqual(
            [call["stage"] for call in transport.calls],
            [
                "coverage_v1.coverage",
                "coverage_v1.fact_audit",
                "coverage_v1.fact_repair",
                "coverage_v1.fact_repair_scope",
                "coverage_v1.fact_reaudit",
            ],
        )
        self.assertTrue(
            report["diagnostics"]["fact_repair"][
                "scope_repair_attempted"
            ]
        )

    def test_scope_retry_resume_does_not_rebuy_fact_repair(self):
        coverage = valid_coverage()
        audit = supported_audit(coverage)
        audit["verdicts"][0]["classification"] = "partially_supported"
        audit["verdicts"][0]["note"] = "The protagonist wording is vague."
        corrected = copy.deepcopy(coverage)
        corrected["story_spine"]["protagonist"] = (
            "Diego Salas, retired goalkeeper"
        )
        corrected["concerns"][0]["point"] = (
            "On p.4, Román Vega threatens the field, but no motive is "
            "established anywhere in the screenplay."
        )
        scope_fixed = copy.deepcopy(corrected)
        scope_fixed["concerns"][0]["point"] = (
            "On p.4, Román Vega threatens the field. The screenplay never "
            "establishes a personal motive for him."
        )
        store = new_store()
        first = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (corrected, settled_usage()),
            RuntimeError("scope transport stopped before dispatch"),
        ])

        with self.assertRaises(RuntimeError):
            run_engine(store, first, max_cost_usd=5.0)

        resume = FakeTransport([
            (scope_fixed, settled_usage()),
            (supported_audit(scope_fixed), settled_usage()),
        ])
        report, usage = run_engine(
            store, resume, max_cost_usd=5.0
        )

        self.assertEqual(
            [call["stage"] for call in resume.calls],
            [
                "coverage_v1.fact_repair_scope",
                "coverage_v1.fact_reaudit",
            ],
        )
        self.assertEqual(usage["call_count"], 2)
        self.assertTrue(
            report["diagnostics"]["fact_repair"]["candidate_replayed"]
        )


class TestBudget(unittest.TestCase):
    def test_request_ceiling_uses_declared_cache_ttl(self):
        request = {
            "model_key": "sonnet",
            "system_blocks": [{
                "type": "text",
                "text": "cached instructions",
                "cache_control": {"type": "ephemeral"},
            }],
            "user_blocks": [{"type": "text", "text": "screenplay"}],
            "tool": cv.COVERAGE_TOOL,
            "thinking_budget": 0,
            "max_tokens": 1,
        }
        five_minute = cv._request_cost_ceiling_microusd(request)
        one_hour_request = copy.deepcopy(request)
        one_hour_request["system_blocks"][0]["cache_control"]["ttl"] = "1h"
        one_hour = cv._request_cost_ceiling_microusd(one_hour_request)

        self.assertLess(five_minute, one_hour)

    def test_cost_cap_fails_closed_and_keeps_coverage(self):
        coverage = valid_coverage()
        transport = FakeTransport(
            [
                (coverage, settled_usage(1_200_000)),  # $1.20 > $1.00 cap
            ]
        )
        store = new_store()
        with self.assertRaises(cv.CoverageBudgetExceededError):
            run_engine(store, transport)
        self.assertEqual(len(transport.calls), 1)
        # Coverage was validated and checkpointed before the cap tripped.
        resume = FakeTransport([(supported_audit(coverage), settled_usage())])
        report, _usage = run_engine(store, resume, max_cost_usd=5.0)
        self.assertEqual(len(resume.calls), 1)
        self.assertFalse(report["replay"]["coverage_replayed"])
        self.assertEqual(report["cost"]["call_count"], 2)

    def test_engine_call_cap_refuses_transport_before_extra_call(self):
        coverage = valid_coverage()
        transport = FakeTransport([
            (coverage, settled_usage()),
            (provider_audit_core(coverage), settled_usage()),
            (supported_detail_payload(coverage), settled_usage()),
        ])

        with self.assertRaisesRegex(
            cv.CoverageBudgetExceededError, "call cap reached: 2 of 2"
        ):
            run_engine(new_store(), transport, max_calls=2)

        self.assertEqual(len(transport.calls), 2)

    def test_call_cap_persists_across_resume(self):
        coverage = valid_coverage()
        store = new_store()
        first = FakeTransport([
            (coverage, settled_usage()),
            RuntimeError("pre-dispatch audit interruption"),
        ])
        with self.assertRaises(RuntimeError):
            run_engine(store, first, max_calls=2)

        resume = FakeTransport([
            (supported_audit(coverage), settled_usage()),
        ])
        with self.assertRaisesRegex(
            cv.CoverageBudgetExceededError, "call cap reached: 1 of 1"
        ):
            run_engine(store, resume, max_calls=1)

        self.assertEqual(len(resume.calls), 0)

    def test_request_ceiling_refuses_overspend_before_transport(self):
        coverage = valid_coverage()
        store = new_store()
        transport = FakeTransport([
            (coverage, settled_usage(40_000)),
            (supported_audit(coverage), settled_usage(70_000)),
        ])

        with patch.object(
            cv,
            "_request_cost_ceiling_microusd",
            side_effect=[50_000, 70_000],
        ):
            with self.assertRaisesRegex(
                cv.CoverageBudgetExceededError, "refusing before dispatch"
            ):
                run_engine(store, transport, max_cost_usd=0.10)

        self.assertEqual(len(transport.calls), 1)

    def test_full_replay_cannot_seal_above_reduced_call_cap(self):
        coverage = valid_coverage()
        store = new_store()
        run_engine(
            store,
            FakeTransport([
                (coverage, settled_usage()),
                (provider_audit_core(coverage), settled_usage()),
                (supported_detail_payload(coverage), settled_usage()),
            ]),
            max_calls=3,
        )

        replay = FakeTransport([])
        with self.assertRaisesRegex(
            cv.CoverageBudgetExceededError, "call cap exceeded"
        ):
            run_engine(store, replay, max_calls=2)

        self.assertEqual(len(replay.calls), 0)

    def test_settled_response_replays_after_stage_checkpoint_crash(self):
        class FailCoverageSaveOnce(cv.LocalCheckpointStore):
            def __init__(self, root: Path):
                super().__init__(root)
                self.failed = False

            def save(self, key: str, stage: str, record: dict) -> None:
                if stage == "coverage" and not self.failed:
                    self.failed = True
                    raise RuntimeError("crash before coverage checkpoint")
                super().save(key, stage, record)

        coverage = valid_coverage()
        store = FailCoverageSaveOnce(Path(tempfile.mkdtemp()) / "cv1")
        first = FakeTransport([(coverage, settled_usage())])
        with self.assertRaisesRegex(RuntimeError, "coverage checkpoint"):
            run_engine(store, first)

        resume = FakeTransport([
            (provider_audit_core(coverage), settled_usage()),
            (supported_detail_payload(coverage), settled_usage()),
        ])
        report, usage = run_engine(store, resume)

        self.assertEqual(len(first.calls), 1)
        self.assertEqual(len(resume.calls), 2)
        self.assertEqual(usage["call_count"], 2)
        self.assertEqual(report["cost"]["call_count"], 3)
        self.assertEqual(report["status"], "sealed")

    def test_sequence_micro_receipt_replays_after_audit_core_crash(self):
        class FailAuditCoreSaveOnce(cv.LocalCheckpointStore):
            def __init__(self, root: Path):
                super().__init__(root)
                self.failed = False

            def save(self, key: str, stage: str, record: dict) -> None:
                if stage == "audit_core" and not self.failed:
                    self.failed = True
                    raise RuntimeError("crash before audit core checkpoint")
                super().save(key, stage, record)

        coverage = valid_coverage()
        bad_core = provider_audit_core(coverage)
        ground_final_scene_for_test(bad_core)
        bad_core["sequence_ledger"]["final_scene"][0][
            "character_knowledge"
        ] = "Both members know the result."
        repaired_core = copy.deepcopy(bad_core)
        repaired_core["sequence_ledger"]["final_scene"][0][
            "character_knowledge"
        ] = "Diego knows that the result is final."
        normalized_repaired = cv.normalize_audit_tool_input(
            repaired_core, range(1, 7)
        )
        first_repair = {"repairs": {
            "row_002_character_knowledge": "Diego celebrates the result."
        }}
        micro_repair = {"repairs": {
            "row_002_character_knowledge": (
                "Diego knows that the result is final."
            )
        }}
        store = FailAuditCoreSaveOnce(Path(tempfile.mkdtemp()) / "cv1")
        first = FakeTransport([
            (coverage, settled_usage()),
            (bad_core, settled_usage()),
            (first_repair, settled_usage()),
            (micro_repair, settled_usage()),
        ])

        with self.assertRaisesRegex(RuntimeError, "audit core checkpoint"):
            run_engine(store, first, max_cost_usd=5.0)

        resume = FakeTransport([(
            supported_detail_payload(coverage, normalized_repaired),
            settled_usage(),
        )])
        report, usage = run_engine(store, resume, max_cost_usd=5.0)

        self.assertEqual(len(first.calls), 4)
        self.assertEqual(len(resume.calls), 1)
        self.assertEqual(
            resume.calls[0]["stage"], "coverage_v1.fact_audit_details"
        )
        self.assertEqual(usage["call_count"], 1)
        self.assertEqual(report["cost"]["call_count"], 5)
        self.assertEqual(report["status"], "sealed")

    def test_detail_contract_bump_preserves_three_settled_receipts(self):
        coverage = valid_coverage()
        bad_core = provider_audit_core(coverage)
        ground_final_scene_for_test(bad_core)
        bad_core["sequence_ledger"]["final_scene"][0][
            "character_knowledge"
        ] = "Both members know the result."
        repaired_core = copy.deepcopy(bad_core)
        repaired_core["sequence_ledger"]["final_scene"][0][
            "character_knowledge"
        ] = "Diego knows that the result is final."
        normalized_repaired = cv.normalize_audit_tool_input(
            repaired_core, range(1, 7)
        )
        first_repair = {"repairs": {
            "row_002_character_knowledge": "Diego celebrates the result."
        }}
        store = new_store()
        first = FakeTransport([
            (coverage, settled_usage()),
            (bad_core, settled_usage()),
            (first_repair, settled_usage()),
        ])

        with patch.object(
            cv, "DETAIL_AUDIT_CONTRACT_VERSION", "coverage-v1.2-detail-11"
        ):
            with self.assertRaisesRegex(
                cv.CoverageBudgetExceededError, "call cap reached: 3 of 3"
            ):
                run_engine(
                    store, first, max_calls=3, max_cost_usd=5.0
                )

        [prior_budget] = list(store.root.glob("*/budget.json"))
        resume = FakeTransport([
            ({"repairs": {
                "row_002_character_knowledge": (
                    "Diego knows that the result is final."
                )
            }}, settled_usage()),
            (
                supported_detail_payload(coverage, normalized_repaired),
                settled_usage(),
            ),
        ])
        report, usage = run_engine(
            store, resume, max_calls=5, max_cost_usd=5.0
        )

        self.assertEqual(len(first.calls), 3)
        self.assertEqual(
            [call["stage"] for call in resume.calls],
            [
                "coverage_v1.fact_audit_rejected_sequence_field_repair",
                "coverage_v1.fact_audit_details",
            ],
        )
        [current_budget] = list(store.root.glob("*/budget.json"))
        self.assertEqual(current_budget.parent, prior_budget.parent)
        self.assertEqual(usage["call_count"], 2)
        self.assertEqual(report["cost"]["call_count"], 5)
        self.assertAlmostEqual(report["cost"]["charged_usd"], 0.3)
        self.assertEqual(report["status"], "sealed")

    def test_rejected_repair_admission_keeps_paid_coverage_receipt(self):
        invalid = valid_coverage()
        invalid["verdict"] = "MAYBE"
        coverage = valid_coverage()
        store = new_store()
        first = FakeTransport([(invalid, settled_usage())])

        with self.assertRaisesRegex(
            cv.CoverageBudgetExceededError, "call cap reached: 1 of 1"
        ):
            run_engine(store, first, max_calls=1)

        resume = FakeTransport([
            (coverage, settled_usage()),
            (provider_audit_core(coverage), settled_usage()),
            (supported_detail_payload(coverage), settled_usage()),
        ])
        report, usage = run_engine(
            store, resume, max_calls=4, max_cost_usd=5.0
        )

        self.assertEqual(
            [call["stage"] for call in resume.calls],
            [
                "coverage_v1.repair",
                "coverage_v1.fact_audit",
                "coverage_v1.fact_audit_details",
            ],
        )
        self.assertEqual(usage["call_count"], 3)
        self.assertEqual(report["cost"]["call_count"], 4)
        self.assertEqual(report["status"], "sealed")


class TestLabels(unittest.TestCase):
    def test_labels_distinguish_fact_interpretation_judgment(self):
        coverage = valid_coverage()
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (supported_audit(coverage), settled_usage()),
            ]
        )
        report, _usage = run_engine(new_store(), transport)
        labels = cv.trust_labels(report)
        self.assertEqual(labels["story_spine"], "FACT_AUDITED")
        self.assertEqual(labels["lens_notes"], "INTERPRETATION")
        self.assertEqual(labels["verdict"], "JUDGMENT")
        self.assertEqual(labels["development_priorities"], "JUDGMENT")
        self.assertEqual(labels["citations"], "VERIFIED_QUOTE")
        self.assertTrue(report["citation_verification"]["integrity_verified"])


if __name__ == "__main__":
    unittest.main(verbosity=1)
