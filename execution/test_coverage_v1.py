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
from functools import lru_cache
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))

import coverage_v1 as cv  # noqa: E402


# ── Fixtures ─────────────────────────────────────────────────────────────────

CALL12_FIXTURE = json.loads(
    (Path(__file__).parent / "fixtures/cosquillitas_call12_regression.json")
    .read_text(encoding="utf-8")
)
COSQUILLITAS_SOURCE_SHA256 = (
    "8e46bdc2fda2cdb3b7ee8bc42574de9e70047174214c632c3047634d4c537276"
)
COSQUILLITAS_PDF = (
    Path(__file__).parent.parent
    / "benchmark-artifacts/coverage-v1-audit-packages/01-COSQUILLITAS/SCREENPLAY.pdf"
)


@lru_cache(maxsize=1)
def real_cosquillitas_source():
    from parse_screenplay_pdf_v2 import extract_text_pymupdf

    text, method = extract_text_pymupdf(COSQUILLITAS_PDF)
    if method != "pymupdf":
        raise AssertionError("Cosquillitas regression requires native PDF text")
    return cv._renumber_page_markers(text, -1)

COSQUILLITAS_LITERAL_SOURCE = """\
[PAGE 89]
10, 10, 10, 10... Calificación perfecta.
[PAGE 90]
Por el pasillo vemos entrar a Cosquillitas, lo hacen lento.
[PAGE 91]
Comienzan a bailar y cantar y lo hacen bastante bien.
[PAGE 92]
Javierín se da cuenta que Juan no va poder cantar, Juan está paralizado.
Javierín da un paso al frente, al parecer él va a sacar adelante el show.
Juanito está cantando algo que oído humano jamás había escuchado.
[PAGE 93]
La ovación es mas fuerte que la que le dieron a los Chavos.
[PAGE 94]
Las primeras tres calificaciones son 10, 10 y 5.
[PAGE 95]
La cuarta calificación es 2. Los nuevos reyes y ganadores son LOS CHAVOS.
Los Chavos se burlan, pero el público no los apoya.
[PAGE 96]
Richie dice que no ha podido dejar de quererte.
Lucesita lo besa.
Lucesita dice: te hice una peluca.
[PAGE 97]
Aparece un video en la gran pantalla donde Dante y Tony hablan del video falso.
Dante y Tony tratan de escapar, pero las puertas se cierran.
El video continúa, ahora aparecen los jueces recibiendo sobornos y regalos.
Los elementos de seguridad los atrapan.
El conductor les entrega el trofeo y el premio del CINLTT.
[PAGE 98]
El video privado de Richie continúa.
Cosquillitas se reúne y sacan a Los Chavos del escenario.
Juanito explica que cantó con una voz que sólo aparece una vez al año.
[PAGE 99]
Lucyfer levanta una prueba de embarazo y Juanito sabe que será padre.
El premio del concurso es un auto último modelo.
[PAGE 100]
El dólar ha bajado tanto que ahora cae más.
Un peso vale 3 dólares.
Anita, soy tu padre.
La paz mundial por fin es una realidad.
La pastilla que cura en minutos la sífilis es anunciada.
Perdón, leí mal, la cura no es un hecho.
[PAGE 101]
Comienza y termina el tema musical de Cosquillitas.
El público pide otra canción.
El público grita Otra y Cosquillitas canta otra canción.
Y YA
"""

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
                "action": (
                    "Diego detiene el último penal de la final y se desploma "
                    "sobre el pasto."
                ),
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
                "action": "Diego survives and stays as coach.",
                "result": "Diego survives and stays as coach.",
                "character_knowledge": (
                    "Diego knows that the result is final."
                ),
                "audience_knowledge": (
                    "The audience sees Diego survive and stay as coach."
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
                "action": "Diego understands the physical risk.",
                "result": "Diego understands the physical risk.",
                "character_knowledge": "Diego understands the physical risk.",
                "audience_knowledge": "Diego understands the physical risk.",
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
        if beat.get(field) == cv.SEQUENCE_KNOWLEDGE_NOT_APPLICABLE:
            action_token = sequence_source_token(
                {**check, "excerpt": beat.get("action", "")},
                row,
                "action",
                text,
            )
            if action_token == cv.SEQUENCE_SOURCE_NOT_LOCATED:
                return action_token
            return (
                f"{row['slot']}:{field}:"
                + action_token.rsplit(":", 1)[-1]
            )
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
            observed_candidates = [
                candidate for candidate in candidates
                if cv._sequence_audience_source_predicate(candidate[1])
            ]
            staged_candidates = [
                candidate for candidate in candidates
                if cv._sequence_literal_fragment_matches(
                    str(beat.get(field, "")), candidate[1]
                )
            ]
            candidates = staged_candidates or observed_candidates or candidates
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
                ))
                + (
                    100
                    if cv._fold_evidence_text(
                        str(beat.get(field, ""))
                    ).strip(" .,:;!?") == excerpt.strip(" .,:;!?")
                    else 0
                ),
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
        by_field = {check["field"]: check for check in checks}
        action_span = cv._sequence_source_span(
            str(by_field.get("action", {}).get("source_id", "")).rsplit(
                ":", 1
            )[-1]
        )
        audience_span = cv._sequence_source_span(
            str(by_field.get("audience_knowledge", {}).get(
                "source_id", ""
            )).rsplit(":", 1)[-1]
        )
        if (
            action_span is not None
            and audience_span is not None
            and action_span[0] == audience_span[0]
            and audience_span[1] > action_span[3] + 1
        ):
            range_id = (
                f"p{action_span[0]:03d}-l{action_span[1]:03d}-"
                f"l{audience_span[1] - 1:03d}"
            )
            if cv._sequence_source_anchor(text, range_id) is not None:
                by_field["action"]["source_id"] = (
                    f"{row['slot']}:action:{range_id}"
                )
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
            beat = row["subject"]["beat"]
            fallback_checks = []
            for field in row["subject"]["required_fields"]:
                source_id = sequence_source_token(
                    {
                        "page": beat["page"],
                        "excerpt": str(beat.get(field, "")),
                        "supports": True,
                    },
                    row,
                    field,
                    text,
                )
                fallback_checks.append({
                    "field": field,
                    "source_id": source_id,
                    "supports": source_id != cv.SEQUENCE_SOURCE_NOT_LOCATED,
                })
            fallback_support = [
                check["supports"] for check in fallback_checks
            ]
            fallback = {
                "classification": (
                    "supported" if all(fallback_support)
                    else "partially_supported" if any(fallback_support)
                    else "unsupported"
                ),
                "checks": fallback_checks,
                "note": "Each decision is bound to a field-local source result.",
            }
            _decoded, fallback_reason = cv._decode_grounded_detail_value(
                fallback, row, text
            )
            if fallback_reason is None:
                value = fallback
                reason = None
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


def literal_beat(actor, action, result, page):
    return {
        "actor": actor,
        "action": action,
        "result": result,
        "character_knowledge": f"{actor} knows that the event occurred.",
        "audience_knowledge": "The audience sees that the event occurred.",
        "page": page,
    }


def cosquillitas_literal_contract(text, content_sha256="f" * 64):
    """Build a tiny exact-source contract for the synthetic screenplay."""
    _numbers, pages = cv._marked_page_contents(text)

    def source_id(page, first_text, last_text=None):
        lines = pages[page].splitlines()
        first = next(
            index for index, line in enumerate(lines, start=1)
            if first_text in line
        )
        last = next(
            index for index, line in enumerate(lines, start=1)
            if (last_text or first_text) in line
        )
        return f"p{page:03d}-l{first:03d}-l{last:03d}"

    def stage(
        stage_id,
        phase,
        page=None,
        first_text=None,
        last_text=None,
        required_text=None,
        requires_negation=False,
    ):
        if page is None:
            return {
                "stage_id": stage_id,
                "phase": phase,
                "source_ids": [],
                "required_source_ids": [],
            }
        allowed = source_id(page, first_text, last_text)
        required = source_id(page, required_text or first_text)
        result = {
            "stage_id": stage_id,
            "phase": phase,
            "source_ids": [allowed],
            "required_source_ids": [required],
        }
        if requires_negation:
            result["requires_negation"] = True
        return result

    stages = [
        stage("climax.001.chavos_perfect_score", "climax", 89, "10, 10"),
        stage("climax.002.cosquillitas_enter_hostile_stage", "climax", 90,
              "Por el pasillo"),
        stage("climax.003.performance_changes_crowd", "climax", 91,
              "Comienzan a bailar"),
        stage("climax.004.juanito_freezes", "climax", 92,
              "Javierín se da cuenta", requires_negation=True),
        stage("climax.005.javierin_steps_forward", "climax", 92,
              "Javierín da un paso"),
        stage("climax.006.juanito_raw_voice", "climax", 92,
              "Juanito está cantando"),
        stage("climax.007.angelic_voice_and_ovation", "climax", 93,
              "La ovación"),
        stage("climax.008.first_three_scores", "climax", 94,
              "Las primeras tres"),
        stage("climax.009.final_score_and_chavos_win", "climax", 95,
              "La cuarta calificación"),
        stage("climax.010.chavos_taunt_rejected", "climax", 95,
              "Los Chavos se burlan"),
        stage("climax.011.richie_declares_love", "climax", 96,
              "Richie dice", requires_negation=True),
        stage("climax.012.lucesita_kisses_richie", "climax", 96,
              "Lucesita lo besa"),
        stage("climax.013.wig_reveal_and_payoff", "climax", 96,
              "Lucesita dice"),
        stage("climax.014.dante_tony_video_exposure", "climax", 97,
              "Aparece un video"),
        stage("climax.015.dante_tony_escape_blocked", "climax", 97,
              "Dante y Tony tratan"),
        stage("climax.016.judges_bribes_exposed", "climax", 97,
              "El video continúa"),
        stage("climax.017.judges_captured", "climax", 97,
              "Los elementos de seguridad"),
        stage("climax.018.trophy_awarded_to_cosquillitas", "climax", 97,
              "El conductor les entrega"),
        stage("ending.001.richie_private_video_continues", "ending", 98,
              "El video privado"),
        stage("ending.002.group_reunion_and_chavos_removed", "ending", 98,
              "Cosquillitas se reúne"),
        stage("ending.003.juanito_explains_voice", "ending", 98,
              "Juanito explica"),
        stage("ending.004.pregnancy_reveal", "ending", 99,
              "Lucyfer levanta"),
        stage("ending.005.vehicle_prize", "ending", 99,
              "El premio del concurso"),
        stage("ending.006.peso_three_dollars", "ending", 100,
              "El dólar", "Un peso", "Un peso"),
        stage("ending.007.anita_father_returns", "ending", 100,
              "Anita, soy tu padre"),
        stage("ending.008.world_peace_announced", "ending", 100,
              "La paz mundial"),
        stage("ending.009.cure_announced", "ending", 100,
              "La pastilla que cura"),
        stage("ending.010.cure_retracted", "ending", 100,
              "Perdón, leí mal", requires_negation=True),
        stage("final_scene.001.celebration_theme", "final_scene", 101,
              "Comienza y termina"),
        stage("final_scene.002.audience_requests_encore", "final_scene", 101,
              "El público pide"),
        stage("final_scene.003.otra_encore", "final_scene", 101,
              "El público grita"),
        stage("tag.001.y_ya", "tag", 101, "Y YA"),
        stage("aftermath.001.not_present", "aftermath"),
    ]
    actors = {
        stage_id: row["actor"]
        for stage_id, row in cosquillitas_literal_rows().items()
    }
    for stage_row in stages:
        stage_row["canonical_actor"] = actors[stage_row["stage_id"]]
    canonical_claims = {
        "climax.001.chavos_perfect_score":
            "10, 10, 10, 10, calificación perfecta.",
        "climax.002.cosquillitas_enter_hostile_stage":
            "Por el pasillo vemos entrar a Cosquillitas, lo hacen lento.",
        "climax.003.performance_changes_crowd":
            "Comienzan a bailar y cantar y lo hacen bastante bien.",
        "climax.004.juanito_freezes":
            "Javierín se da cuenta que Juan no va poder cantar, Juan está paralizado.",
        "climax.005.javierin_steps_forward":
            "Javierín da un paso al frente, al parecer él va a sacar adelante el show.",
        "climax.006.juanito_raw_voice":
            "Juanito está cantando algo que oído humano jamás había escuchado.",
        "climax.007.angelic_voice_and_ovation":
            "La ovación es mas fuerte que la que le dieron a los Chavos.",
        "climax.008.first_three_scores":
            "Las primeras tres calificaciones son 10, 10 y 5.",
        "climax.009.final_score_and_chavos_win":
            "Los Chavos ganan con la cuarta calificación de 2.",
        "climax.010.chavos_taunt_rejected":
            "Los Chavos se burlan, pero el público no los apoya.",
        "climax.011.richie_declares_love":
            "Richie dice que no ha podido dejar de quererte.",
        "climax.012.lucesita_kisses_richie": "Lucesita lo besa.",
        "climax.013.wig_reveal_and_payoff":
            "Lucesita le hizo una peluca.",
        "climax.014.dante_tony_video_exposure":
            "El video falso muestra a Dante junto con Tony.",
        "climax.015.dante_tony_escape_blocked":
            "El escape de Dante junto con Tony queda bloqueado por las puertas cerradas.",
        "climax.016.judges_bribes_exposed":
            "El video muestra a los jueces recibiendo sobornos junto con regalos.",
        "climax.017.judges_captured":
            "Los elementos de seguridad los atrapan.",
        "climax.018.trophy_awarded_to_cosquillitas":
            "El conductor entrega el trofeo como premio del CINLTT.",
        "ending.001.richie_private_video_continues":
            "El video privado de Richie continúa.",
        "ending.002.group_reunion_and_chavos_removed":
            "Cosquillitas se reúne y sacan a Los Chavos del escenario.",
        "ending.003.juanito_explains_voice":
            "Juanito explica que cantó con una voz que sólo aparece una vez al año.",
        "ending.004.pregnancy_reveal":
            "La prueba de embarazo de Lucyfer revela que Juanito será padre.",
        "ending.005.vehicle_prize":
            "El premio del concurso es un auto último modelo.",
        "ending.006.peso_three_dollars": "Un peso vale 3 dólares.",
        "ending.007.anita_father_returns": "Anita, soy tu padre.",
        "ending.008.world_peace_announced":
            "La paz mundial por fin es una realidad.",
        "ending.009.cure_announced":
            "La pastilla que cura en minutos la sífilis es anunciada.",
        "ending.010.cure_retracted":
            "Perdón leí mal la cura no es un hecho.",
        "final_scene.001.celebration_theme":
            "Comienza y termina el tema musical de Cosquillitas.",
        "final_scene.002.audience_requests_encore":
            "El público pide otra canción.",
        "final_scene.003.otra_encore":
            "El público grita Otra y Cosquillitas canta otra canción.",
        "tag.001.y_ya": "Y YA",
    }
    return {
        "contract_version": cv.LITERAL_SEQUENCE_CONTRACT_VERSION,
        "content_sha256": content_sha256,
        "normalized_text_sha256": cv._literal_sequence_text_sha256(text),
        "canonical_source_claims": {
            stage_row["required_source_ids"][0]: [{
                "field": "action",
                "text": canonical_claims[stage_row["stage_id"]],
            }]
            for stage_row in stages
            if stage_row["required_source_ids"]
        },
        "stages": stages,
    }


def cosquillitas_literal_inventory():
    contract = cosquillitas_literal_contract(COSQUILLITAS_LITERAL_SOURCE)
    with patch.object(
        cv, "_load_literal_sequence_contract", return_value=contract
    ):
        return cv.build_literal_sequence_stage_inventory(
            COSQUILLITAS_LITERAL_SOURCE, "f" * 64
        )


def cosquillitas_literal_candidate():
    sequence = {
        "climax": [
            literal_beat(
                "Cosquillitas ensemble",
                "Enter the final stage facing a hostile crowd.",
                "Cosquillitas take their places amid booing.",
                90,
            ),
            literal_beat(
                "Cosquillitas ensemble",
                "Begin performing while singing and dancing.",
                "The public gradually pays attention.",
                91,
            ),
            literal_beat(
                "Juanito",
                "Juanito freezes and cannot sing; Javierín steps forward to "
                "cover for him; Juanito releases a vocal performance.",
                "The audience is hypnotized and gives Juanito a stronger "
                "ovation than Los Chavos.",
                92,
            ),
            literal_beat(
                "Three judges",
                "First judge scores 10, second scores 10, third scores 5, "
                "fourth scores 2.",
                "Los Chavos win and are declared winners.",
                93,
            ),
            literal_beat(
                "Richie and Lucesita",
                "Richie says he never stopped loving Lucesita; she kisses "
                "him and gives him a wig.",
                "Richie and Lucesita reconcile.",
                96,
            ),
            literal_beat(
                "Dante and Tony",
                "A hidden-camera video plays on the enormous arena screen "
                "showing Dante and Tony discussing the fabricated interview "
                "video and Tony revealing he bribed judges with watches, "
                "money, lingerie, and a Memo Ochoa poster.",
                "Video exposure causes judges to attempt escape; security "
                "detains all judges; conductor formally announces the result "
                "will be overturned and trophy awarded to Cosquillitas; "
                "public erupts in approval.",
                97,
            ),
        ],
        "ending": [
            literal_beat(
                "Lucyfer",
                "Lucyfer waves a positive pregnancy test.",
                "Juanito learns he will be a father.",
                99,
            ),
            literal_beat(
                "The conductor",
                "The conductor announces a bonus car prize.",
                "Cosquillitas receive the vehicle.",
                99,
            ),
            literal_beat(
                "Anita's father",
                "Anita's long-absent father reappears.",
                "He seeks reconciliation.",
                100,
            ),
            literal_beat(
                "The conductor",
                "The conductor announces world peace and a cure for "
                "syphilis, then corrects the cure announcement.",
                "The crowd celebrates; one man sits down embarrassed.",
                100,
            ),
        ],
        "final_scene": [literal_beat(
            "Cosquillitas ensemble",
            "The crowd demands more, then Cosquillitas perform an encore "
            "song called Otra.",
            "Cosquillitas complete the encore.",
            101,
        )],
        "tag": [literal_beat(
            "The text Y YA",
            "Text appears: Y YA.",
            "The screenplay ends.",
            101,
        )],
        "aftermath": [{
            **literal_beat("NOT PRESENT", "NOT PRESENT", "NOT PRESENT", 101),
            "character_knowledge": "NOT PRESENT",
            "audience_knowledge": "NOT PRESENT",
        }],
    }
    return cv.normalize_audit_tool_input(
        {"verdicts": [], "sequence_ledger": sequence}, range(1, 102)
    )


def cosquillitas_literal_rows():
    rows = {
        "climax.001.chavos_perfect_score": literal_beat(
            "The judges", "The four judges score 10, 10, 10, and 10.",
            "Los Chavos receive a perfect score.", 89,
        ),
        "climax.002.cosquillitas_enter_hostile_stage": literal_beat(
            "Cosquillitas", "Cosquillitas enter the hostile stage.",
            "They take their places amid booing.", 90,
        ),
        "climax.003.performance_changes_crowd": literal_beat(
            "Cosquillitas", "Cosquillitas perform by singing and dancing.",
            "The crowd begins paying attention.", 91,
        ),
        "climax.004.juanito_freezes": literal_beat(
            "Juanito", "Juanito freezes and cannot sing.",
            "Juanito cannot perform.", 92,
        ),
        "climax.005.javierin_steps_forward": literal_beat(
            "Javierín", "Javierín steps forward to cover for Juanito.",
            "Javierín takes the lead.", 92,
        ),
        "climax.006.juanito_raw_voice": literal_beat(
            "Juanito", "Juanito sings in his raw voice.",
            "Juanito takes over the performance.", 92,
        ),
        "climax.007.angelic_voice_and_ovation": literal_beat(
            "The audience", "The audience gives Juanito a stronger ovation.",
            "His ovation exceeds the one given to Los Chavos.", 93,
        ),
        "climax.008.first_three_scores": literal_beat(
            "The first three judges", "The judges score 10, 10, and 5.",
            "Three scores are revealed.", 94,
        ),
        "climax.009.final_score_and_chavos_win": literal_beat(
            "The fourth judge", "The fourth judge scores 2.",
            "Los Chavos win and are declared winners.", 95,
        ),
        "climax.010.chavos_taunt_rejected": literal_beat(
            "Los Chavos", "Los Chavos taunt Cosquillitas.",
            "The audience rejects their taunt.", 95,
        ),
        "climax.011.richie_declares_love": literal_beat(
            "Richie", "Richie says his love for Lucesita never stopped.",
            "Richie chooses Lucesita before the exposé.", 96,
        ),
        "climax.012.lucesita_kisses_richie": literal_beat(
            "Lucesita", "Lucesita kisses Richie.",
            "They reconcile before the exposé.", 96,
        ),
        "climax.013.wig_reveal_and_payoff": literal_beat(
            "Lucesita", "Lucesita gives Richie the wig she made.",
            "Richie receives the wig before the exposé.", 96,
        ),
        "climax.014.dante_tony_video_exposure": literal_beat(
            "Dante and Tony", "A video shows Dante and Tony discussing the "
            "fabricated interview video.",
            "The arena sees their involvement.", 97,
        ),
        "climax.015.dante_tony_escape_blocked": literal_beat(
            "Dante and Tony", "Dante and Tony try to escape.",
            "The closing doors block their escape.", 97,
        ),
        "climax.016.judges_bribes_exposed": literal_beat(
            "The judges", "The video shows the judges receiving bribes.",
            "Their corruption is exposed.", 97,
        ),
        "climax.017.judges_captured": literal_beat(
            "Security", "Security captures the judges.",
            "The judges are detained.", 97,
        ),
        "climax.018.trophy_awarded_to_cosquillitas": literal_beat(
            "The conductor", "The conductor awards the trophy and prize.",
            "Cosquillitas receive the trophy.", 97,
        ),
        "ending.001.richie_private_video_continues": literal_beat(
            "The video", "The video continues with Richie's private footage.",
            "The audience sees Richie's private footage.", 98,
        ),
        "ending.002.group_reunion_and_chavos_removed": literal_beat(
            "Cosquillitas", "Cosquillitas reunite and remove Los Chavos.",
            "Cosquillitas reclaim the stage.", 98,
        ),
        "ending.003.juanito_explains_voice": literal_beat(
            "Juanito", "Juanito explains his rare voice.",
            "The group learns why his voice changed.", 98,
        ),
        "ending.004.pregnancy_reveal": literal_beat(
            "Lucyfer", "Lucyfer raises a positive pregnancy test.",
            "Juanito learns he will be a father.", 99,
        ),
        "ending.005.vehicle_prize": literal_beat(
            "The contest", "The contest awards Cosquillitas a car prize.",
            "Cosquillitas receive the vehicle.", 99,
        ),
        "ending.006.peso_three_dollars": literal_beat(
            "The conductor", "The conductor announces that one peso is worth "
            "3 dollars.", "The currency relation is one peso to 3 dollars.",
            100,
        ),
        "ending.007.anita_father_returns": literal_beat(
            "Anita's father", "Anita's father returns.",
            "He identifies himself and seeks reconciliation with Anita.", 100,
        ),
        "ending.008.world_peace_announced": literal_beat(
            "The conductor", "The conductor announces world peace.",
            "World peace is presented as real.", 100,
        ),
        "ending.009.cure_announced": literal_beat(
            "The conductor", "The conductor announces a syphilis cure.",
            "The cure is presented as real.", 100,
        ),
        "ending.010.cure_retracted": literal_beat(
            "The conductor", "The conductor retracts the cure announcement.",
            "He says the cure is not a fact.", 100,
        ),
        "final_scene.001.celebration_theme": literal_beat(
            "Cosquillitas", "Cosquillitas' musical theme starts and ends.",
            "The theme completes the celebration.", 101,
        ),
        "final_scene.002.audience_requests_encore": literal_beat(
            "The audience", "The audience asks for another song.",
            "Cosquillitas hear the request.", 101,
        ),
        "final_scene.003.otra_encore": literal_beat(
            "Cosquillitas", "Cosquillitas perform another song called Otra.",
            "They complete the encore.", 101,
        ),
        "tag.001.y_ya": {
            **literal_beat(
                "The text Y YA", "The text Y YA appears.",
                "The screenplay ends.", 101,
            ),
            "character_knowledge": cv.SEQUENCE_KNOWLEDGE_NOT_APPLICABLE,
        },
        "aftermath.001.not_present": {
            **literal_beat(
                "NOT PRESENT", "NOT PRESENT", "NOT PRESENT", 101,
            ),
            "character_knowledge": "NOT PRESENT",
            "audience_knowledge": "NOT PRESENT",
        },
    }
    return rows


def cosquillitas_literal_correction(_candidate, inventory):
    rows = cosquillitas_literal_rows()
    response = {"sequence_ledger": {
        phase: [] for phase in cv.AUDIT_SEQUENCE_PHASES
    }}
    allowed = set(cv._AUDIT_SEQUENCE_BEAT_SCHEMA["required"])
    for stage in inventory:
        row = {
            key: copy.deepcopy(value)
            for key, value in rows[str(stage["stage_id"])].items()
            if key in allowed
        }
        for field in ("action", "result"):
            canonical_claims = [
                str(required["canonical_claim"])
                for required in stage.get("required_sources", [])
                if required.get("canonical_field") == field
            ]
            if canonical_claims:
                row[field] = "; ".join(canonical_claims)
        row["stage_id"] = stage["stage_id"]
        response["sequence_ledger"][stage["phase"]].append(row)
    return response


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

    def test_cosquillitas_resolution_cascade_stays_human_taste(self):
        coverage = valid_coverage()
        coverage["development_priorities"][0] = {
            "priority": "Thin and sequence the final resolution cascade",
            "why": "The comic pile-on overwhelms the emotional landing",
            "how": "Let the romance breathe, then accelerate the parody",
        }

        checks = [
            row for row in cv.build_existing_evidence_checks(
                coverage, SCREENPLAY_TEXT
            )
            if row["source_field_path"] == "development_priorities[0]"
        ]
        [row] = [
            item for item in cv.build_detail_audit_rows(coverage, checks)
            if item["identifier"] == "development_priorities[0]"
        ]
        evidence, _citations = cv.decode_detail_audit_payload(
            {"results": {row["slot"]: (
                "unsupported: The pacing recommendation is a producer choice."
            )}},
            [row],
            SCREENPLAY_TEXT,
        )
        self.assertEqual(
            evidence[0]["factual_applicability"], "not_applicable"
        )
        reconciled = cv._replace_audit_details(
            supported_audit(coverage), evidence, []
        )
        guard = next(
            item for item in reconciled["verdicts"]
            if item["claim_id"] == "guard.existing_evidence"
        )
        self.assertEqual(guard["classification"], "supported")

        coverage["development_priorities"][0] = {
            "priority": "Add a murder weapon",
            "why": "No weapon appears anywhere in the screenplay",
            "how": "Plant one before the climax",
        }
        checks = cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT)
        [row] = [
            item for item in cv.build_detail_audit_rows(coverage, checks)
            if item["identifier"] == "development_priorities[0]"
        ]
        evidence, _citations = cv.decode_detail_audit_payload(
            {"results": {row["slot"]: (
                "unsupported: This is editorial advice, not a factual claim."
            )}},
            [row],
            SCREENPLAY_TEXT,
        )
        self.assertNotIn("factual_applicability", evidence[0])

    def test_cosquillitas_mixed_resolution_priority_stays_fact_auditable(self):
        coverage = valid_coverage()
        coverage["development_priorities"][0] = {
            "priority": "Thin and sequence the final resolution cascade",
            "why": (
                "The script resolves five character arcs plus a meta-satirical "
                "layer in approximately three pages (pp. 98–101), so rapidly "
                "that the pregnancy announcement (Juanito's deepest unfulfilled "
                "need, established as early as p. 15) and the Richie-Lucesita "
                "reunion (the script's emotional engine since p. 12) are swamped "
                "by world peace declarations and STI-cure jokes. The absurdist "
                "pile-on reads as structural exhaustion rather than intentional "
                "parody unless the order and rhythm are controlled."
            ),
            "how": (
                "Stage the two genuinely earned resolutions first and give each "
                "a full beat: (1) Richie's return to Lucesita with the wig — let "
                "this breathe for at least a page, it is the most romantic thing "
                "in the script; (2) Lucyfer's pregnancy reveal — this is "
                "Juanito's true All Is Lost element and deserves a clean "
                "emotional landing before the comedy resumes. Then introduce the "
                "escalating absurd cascade (car, peso, world peace, gonorrhea) as "
                "a deliberate comedic coda — four rapid beats in succession — "
                "making it clear the tone has shifted to parody of the genre's "
                "resolution conventions. This structure preserves emotional "
                "catharsis while honoring the script's satirical voice."
            ),
        }

        checks = cv.build_existing_evidence_checks(
            coverage, SCREENPLAY_TEXT
        )
        [row] = [
            item for item in cv.build_detail_audit_rows(coverage, checks)
            if item["identifier"] == "development_priorities[0]"
        ]
        evidence, _citations = cv.decode_detail_audit_payload(
            {"results": {row["slot"]: (
                "unsupported: The recommendation mixes taste with factual "
                "claims about the ending."
            )}},
            [row],
            SCREENPLAY_TEXT,
        )

        self.assertNotIn("factual_applicability", evidence[0])

    def test_character_event_recommendation_stays_fact_auditable(self):
        coverage = valid_coverage()
        coverage["development_priorities"][0] = {
            "priority": "Cut the scene where Carlos kills Anita",
            "why": "It repeats information",
            "how": "Move directly to the aftermath",
        }

        checks = cv.build_existing_evidence_checks(
            coverage, SCREENPLAY_TEXT
        )
        [row] = [
            item for item in cv.build_detail_audit_rows(coverage, checks)
            if item["identifier"] == "development_priorities[0]"
        ]
        for classification in (
            "unsupported", "partially_supported", "contradicted"
        ):
            with self.subTest(classification=classification):
                evidence, _citations = cv.decode_detail_audit_payload(
                    {"results": {row["slot"]: (
                        f"{classification}: Carlos does not kill Anita in "
                        "the screenplay."
                    )}},
                    [row],
                    SCREENPLAY_TEXT,
                )

                self.assertNotIn("factual_applicability", evidence[0])

    def test_factual_clause_cannot_hide_behind_an_editorial_verb(self):
        claims = (
            (
                "Trim the sequence because the house burns down before the "
                "family escapes."
            ),
            "Tighten the scene because he steals the money.",
        )

        for claim in claims:
            with self.subTest(claim=claim):
                self.assertFalse(
                    cv._recommendation_is_editorial_only(
                        claim, "unsupported"
                    )
                )

    def test_concrete_story_edit_is_not_pure_editorial_taste(self):
        priorities = (
            (
                "Trim the car explosion",
                "The action pacing feels repetitive",
                "Tighten the beat",
            ),
            (
                "Cut the courtroom scene",
                "The comic pacing feels slow",
                "Tighten the transition",
            ),
            (
                "Move the funeral earlier",
                "The emotional rhythm feels slow",
                "Tighten the ending",
            ),
        )

        for parts in priorities:
            with self.subTest(priority=parts[0]):
                self.assertFalse(
                    cv._recommendation_is_editorial_only(
                        " ".join(parts), "unsupported", parts
                    )
                )

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

    def test_fixed_sequence_transport_derives_partial_classification(self):
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
            and "character_knowledge" in row["subject"]["required_fields"]
        )
        payload = typed_detail_payload_for_rows([row])
        group = cv._detail_result_group(row)
        payload[group][0]["classification"] = "supported"
        payload[group][0]["character_knowledge_source_id"] = (
            cv.SEQUENCE_SOURCE_NOT_LOCATED
        )

        expanded = cv._expand_detail_audit_payload(payload, [row])

        self.assertEqual(
            expanded["results"][row["slot"]]["classification"],
            "partially_supported",
        )

    def test_call12_range_token_is_canonicalized_before_validation(self):
        case = CALL12_FIXTURE["rejected_transport_case"]
        row = {"slot": case["slot"], "kind": "sequence_evidence"}

        anchor, reason = cv._sequence_source_token_anchor(
            case["source_id"],
            row,
            case["field"],
        )

        self.assertIsNone(reason)
        self.assertEqual(anchor, case["canonical_source_id"])

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
                "different named actor cannot inherit across adjacent lines",
                (
                    "[PAGE 1]\nDiego leaves the room.\n"
                    "Carlos shoots Ana.\n"
                ),
                "Diego",
                "Carlos shoots Ana.",
                "Diego leaves the room",
                "Carlos shoots Ana",
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

    def test_sequence_actor_and_action_cannot_name_different_agents(self):
        actions = (
            "Carlos shoots Ana.",
            "Carlos shoots Diego.",
            "Carlos shoots Ana while Diego watches.",
            "Ana gives Diego the gun.",
            "Carlos and Diego shoot Ana.",
            "Diego and Carlos shoot Ana.",
            "Diego y Carlos disparan a Ana.",
            "Diego is shot by Carlos.",
        )
        for action in actions:
            with self.subTest(action=action):
                source = (
                    "[PAGE 1]\nDiego waits by the gate.\n" + action + "\n"
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
                            "action": action,
                            "result": "NOT LOCATED",
                            "character_knowledge": "NOT LOCATED",
                            "audience_knowledge": "NOT LOCATED",
                        },
                        "required_fields": ["actor", "action"],
                        "claim_sha256": "a" * 64,
                    },
                }
                value = {
                    "classification": "supported",
                    "checks": [
                        {
                            "field": field,
                            "source_id": (
                                f"{row['slot']}:{field}:p001-l001-l002"
                            ),
                            "supports": True,
                        }
                        for field in ("actor", "action")
                    ],
                    "note": "The same range is claimed for both fields.",
                }

                decoded, reason = cv._decode_grounded_detail_value(
                    value, row, source
                )

                self.assertIsNone(decoded)
                self.assertEqual(
                    reason, "actor roles are absent from the claimed action"
                )

    def test_sequence_actor_rejects_unclaimed_leading_coagents(self):
        for action in (
            "Diego with Carlos dances.",
            "Diego alongside Carlos dances.",
            "Diego as well as Carlos shoots Ana.",
            "Diego together with Carlos shoots Ana.",
            "Diego plus Carlos shoot Ana.",
            "Diego junto con Carlos canta.",
            "Diego con Carlos baila.",
        ):
            with self.subTest(action=action):
                source = (
                    "[PAGE 1]\nDiego waits by the gate.\n" + action + "\n"
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
                            "action": action,
                            "result": "NOT LOCATED",
                            "character_knowledge": "NOT LOCATED",
                            "audience_knowledge": "NOT LOCATED",
                        },
                        "required_fields": ["actor", "action"],
                        "claim_sha256": "a" * 64,
                    },
                }
                value = {
                    "classification": "supported",
                    "checks": [
                        {
                            "field": "actor",
                            "source_id": "row_001:actor:p001-l001",
                            "supports": True,
                        },
                        {
                            "field": "action",
                            "source_id": "row_001:action:p001-l002",
                            "supports": True,
                        },
                    ],
                    "note": "The source is claimed to support both fields.",
                }

                decoded, reason = cv._decode_grounded_detail_value(
                    value, row, source
                )

                self.assertIsNone(decoded)
                self.assertEqual(
                    reason, "actor roles are absent from the claimed action"
                )

        for actor, actor_line, action in (
            (
                "The judges",
                "The judges wait by the gate.",
                "The judges and Carlos shoot Ana.",
            ),
            (
                "Los jueces",
                "Los jueces esperan junto a la puerta.",
                "Los jueces y Carlos disparan a Ana.",
            ),
            (
                "The audience",
                "The audience waits by the gate.",
                "The audience and Carlos applaud.",
            ),
            (
                "El público",
                "El público espera junto a la puerta.",
                "El público y Carlos aplauden.",
            ),
            (
                "The crowd",
                "The crowd waits by the gate.",
                "The crowd and Carlos cheer.",
            ),
            (
                "The police",
                "The police wait by the gate.",
                "The police and Carlos arrest Tony.",
            ),
            (
                "The audience",
                "The audience waits by the gate.",
                "Together, the audience and Carlos applaud.",
            ),
            (
                "The audience",
                "The audience waits by the gate.",
                "Carlos and the audience applaud.",
            ),
            (
                "El público",
                "El público espera junto a la puerta.",
                "Juntos, el público y Carlos aplauden.",
            ),
            (
                "El público",
                "El público espera junto a la puerta.",
                "Carlos y el público aplauden.",
            ),
            (
                "The crowd",
                "The crowd waits by the gate.",
                "At once, the crowd and Carlos cheer.",
            ),
            (
                "The police",
                "The police wait by the gate.",
                "Outside, the police and Carlos arrest Tony.",
            ),
            (
                "The audience",
                "The audience waits by the gate.",
                "The audience and also Carlos applaud.",
            ),
            (
                "El público",
                "El público espera junto a la puerta.",
                "El público y también Carlos aplauden.",
            ),
            (
                "The audience",
                "The audience waits by the gate.",
                "The audience versus Carlos compete.",
            ),
            (
                "Carlos and the audience",
                "Carlos and the audience wait by the gate.",
                "Carlos greets the audience.",
            ),
            (
                "Carlos and the crowd",
                "Carlos and the crowd wait by the gate.",
                "Carlos addresses the crowd.",
            ),
            (
                "Carlos y el público",
                "Carlos y el público esperan junto a la puerta.",
                "Carlos saluda al público.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves. That night, Diego attacks Ana.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves; That night, Diego attacks Ana.",
            ),
            (
                "The audience",
                "The audience waits by the gate.",
                "The audience along with Carlos applaud.",
            ),
            (
                "The audience",
                "The audience waits by the gate.",
                "The audience and even Carlos applaud.",
            ),
            (
                "El público",
                "El público espera junto a la puerta.",
                "El público además de Carlos aplaude.",
            ),
            (
                "El público",
                "El público espera junto a la puerta.",
                "El público e incluso Carlos aplaude.",
            ),
            (
                "Carlos and Ana",
                "Carlos and Ana wait by the gate.",
                "Carlos with a knife attacks Ana.",
            ),
            (
                "Carlos y Ana",
                "Carlos y Ana esperan junto a la puerta.",
                "Carlos con furia ataca a Ana.",
            ),
            (
                "Carlos and the audience",
                "Carlos and the audience wait by the gate.",
                "Carlos with a microphone addresses the audience.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves while the audience applauds.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves. The audience applauds.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves as the crowd cheers.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves while the police arrest Tony.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves while a masked man attacks Ana.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves. The video appears.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves while security arrests Tony.",
            ),
            (
                "Carlos",
                "Carlos espera junto a la puerta.",
                "Carlos sale mientras seguridad detiene a Tony.",
            ),
            (
                "Carlos",
                "Carlos espera junto a la puerta.",
                "Carlos sale mientras el público aplaude.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves while police arrest Tony.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves while his audience applauds.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves while suddenly the audience applauds.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves and security arrests Tony.",
            ),
            (
                "The judges",
                "The judges wait by the gate.",
                "The judges leave while he attacks Ana.",
            ),
            (
                "Los jueces",
                "Los jueces esperan junto a la puerta.",
                "Los jueces salen mientras ella ataca a Ana.",
            ),
            (
                "Carlos and Ana",
                "Carlos and Ana wait by the gate.",
                "Carlos and Ana leave while he attacks Tony.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves after security arrests Tony.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves because security arrests Tony.",
            ),
            (
                "Carlos",
                "Carlos espera junto a la puerta.",
                "Carlos sale después de que seguridad detiene a Tony.",
            ),
            (
                "Carlos",
                "Carlos espera junto a la puerta.",
                "Carlos sale porque seguridad detiene a Tony.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves: security arrests Tony.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves — security arrests Tony.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves, security arrests Tony.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves, fans wave.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves – fans wave.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos grabs the camera, the police arrest Tony, and the "
                "audience applauds.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos sees the judges, the police arrest Tony, and the "
                "audience applauds.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos takes the cup, the crew move, and the band play.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos grabs the cup, the team win, and the crew move.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos takes the ball, the red wins, and the trophy.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos takes the cup, the red runs, and the coat.",
            ),
            (
                "Ana",
                "Ana espera junto a la puerta.",
                "Ana toma la copa, él canta, y el abrigo.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves and fans wave.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves but crew move.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves plus fans wave.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves yet fans wave.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves or fans wave.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves nor fans wave.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves with the audience applauding.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves with the police arresting Tony.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves upon security arresting Tony.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves (security arrests Tony).",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves [security arrests Tony].",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves (the crew move equipment).",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves (fans wave).",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves (security arrests Tony.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves [security arrests Tony.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves ([security arrests Tony)].",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves).",
            ),
            (
                "Carlos and security",
                "Carlos and security wait by the gate.",
                "Carlos leaves (security arrests Tony.",
            ),
            (
                "Carlos and security",
                "Carlos and security wait by the gate.",
                "Carlos leaves [security arrests Tony.",
            ),
            (
                "Carlos and security",
                "Carlos and security wait by the gate.",
                "Carlos leaves ([security arrests Tony)].",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                'Carlos leaves "security arrests Tony.',
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves “security arrests Tony.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                "Carlos leaves ‘security arrests Tony.",
            ),
            (
                "Carlos",
                "Carlos waits by the gate.",
                'Carlos leaves “security arrests Tony".',
            ),
            (
                "Carlos and security",
                "Carlos and security wait by the gate.",
                'Carlos leaves "security arrests Tony.',
            ),
            (
                "Carlos and security",
                "Carlos and security wait by the gate.",
                "Carlos leaves “security arrests Tony.",
            ),
            (
                "Carlos",
                "Carlos espera junto a la puerta.",
                "Carlos sale con el público aplaudiendo.",
            ),
        ):
            with self.subTest(actor=actor, action=action):
                source = f"[PAGE 1]\n{actor_line}\n{action}\n"
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
                decoded, reason = cv._decode_grounded_detail_value(
                    {
                        "classification": "supported",
                        "checks": [
                            {
                                "field": "actor",
                                "source_id": "row_001:actor:p001-l001",
                                "supports": True,
                            },
                            {
                                "field": "action",
                                "source_id": "row_001:action:p001-l002",
                                "supports": True,
                            },
                        ],
                        "note": "The source is claimed to support both fields.",
                    },
                    row,
                    source,
                )

                self.assertIsNone(decoded)
                self.assertEqual(
                    reason, "actor roles are absent from the claimed action"
                )

        for actor, action in (
            ("The audience", "The audience applauds."),
            ("The audience", "Together, the audience applauds."),
            ("El público", "El público aplaude."),
            ("El público", "Juntos, el público aplaude."),
            ("The crowd", "At once, the crowd cheers."),
            ("The police", "Outside, the police arrest Tony."),
            (
                "Carlos and the audience",
                "Carlos and the audience greet Ana.",
            ),
            (
                "Carlos y el público",
                "Carlos y el público saludan a Ana.",
            ),
            (
                "The audience and Carlos",
                "The audience along with Carlos applaud.",
            ),
            (
                "El público y Carlos",
                "El público además de Carlos aplaude.",
            ),
            ("Carlos and Ana", "Carlos and Ana attack Tony."),
            (
                "Carlos and the audience",
                "Carlos leaves while the audience applauds.",
            ),
            (
                "Carlos and the crowd",
                "Carlos leaves as the crowd cheers.",
            ),
            (
                "Carlos and the police",
                "Carlos leaves while the police arrest Tony.",
            ),
            (
                "Carlos and a masked man",
                "Carlos leaves while a masked man attacks Ana.",
            ),
            (
                "Carlos and the video",
                "Carlos leaves. The video appears.",
            ),
            ("Carlos", "Carlos works as the police liaison."),
            (
                "Carlos and security",
                "Carlos leaves while security arrests Tony.",
            ),
            (
                "Carlos y seguridad",
                "Carlos sale mientras seguridad detiene a Tony.",
            ),
            ("Carlos", "Carlos leaves and returns home."),
            ("Carlos", "Carlos takes the bag and the red gun."),
            ("Carlos", "Carlos leaves while he watches Tony."),
            ("Carlos", "Carlos sale mientras él observa a Tony."),
            (
                "The judges",
                "The judges leave while they watch Tony.",
            ),
            (
                "Los jueces",
                "Los jueces salen mientras ellos observan a Tony.",
            ),
            (
                "Carlos and Ana",
                "Carlos and Ana leave while they watch Tony.",
            ),
            (
                "Carlos and security",
                "Carlos leaves after security arrests Tony.",
            ),
            (
                "Carlos and the audience",
                "Carlos leaves with the audience applauding.",
            ),
            (
                "Carlos and the police",
                "Carlos leaves with the police arresting Tony.",
            ),
            (
                "Carlos and security",
                "Carlos leaves upon security arresting Tony.",
            ),
            (
                "Carlos y el público",
                "Carlos sale con el público aplaudiendo.",
            ),
            (
                "Carlos y seguridad",
                "Carlos sale después de que seguridad detiene a Tony.",
            ),
            (
                "Carlos and security",
                "Carlos leaves (security arrests Tony).",
            ),
            (
                "Carlos and security",
                "Carlos leaves [security arrests Tony].",
            ),
            (
                "Carlos and the crew",
                "Carlos leaves (the crew move equipment).",
            ),
            (
                "Carlos and fans",
                "Carlos leaves (fans wave).",
            ),
            ("Carlos", "Carlos leaves (quietly)."),
            ("Carlos", "Carlos leaves (without warning)."),
            ("Carlos", "Carlos performs ('Otra!')."),
            ("Carlos", "Carlos enters (The Final Show)."),
            ("Carlos", 'Carlos says "security arrests Tony."'),
            ("Carlos", "Carlos says ‘Fans’ wave."),
            ("Carlos", "Carlos says ‘don’t leave.’"),
            ("Carlos", "Carlos doesn't leave."),
            ("Carlos", "Carlos reads James' note."),
            ("Carlos", "Carlos leaves after the ceremony."),
            ("Carlos", "Carlos has worked as the police liaison."),
            ("Carlos", "Carlos leaves before the result changes."),
            ("Carlos", "Carlos waits before God's order."),
            ("Carlos and fans", "Carlos leaves, fans wave."),
            ("Carlos and fans", "Carlos leaves plus fans wave."),
            ("Carlos and fans", "Carlos leaves yet fans wave."),
            ("Carlos and fans", "Carlos leaves or fans wave."),
            ("Carlos and fans", "Carlos leaves nor fans wave."),
            (
                "Carlos and security",
                "Carlos leaves: security arrests Tony.",
            ),
            (
                "Carlos",
                "Carlos grabs the camera, the trophy, and the wig.",
            ),
            ("Carlos", "Carlos takes the bag, the red gun, and the coat."),
            (
                "Public, Juanito, and Cosquillitas",
                "Public demands encore ('Otra!'); Juanito announces the "
                "song is titled Otra; Cosquillitas performs it.",
            ),
        ):
            with self.subTest(actor=actor, action=action):
                self.assertTrue(
                    cv._sequence_named_actor_roster_matches_action(
                        actor, action
                    )
                )

    def test_parenthetical_clause_accepts_complete_actor_roster(self):
        for actor, action in (
            (
                "Carlos and security",
                "Carlos leaves (security arrests Tony).",
            ),
            (
                "Carlos and the crew",
                "Carlos leaves (the crew move equipment).",
            ),
            ("Carlos and fans", "Carlos leaves (fans wave)."),
        ):
            with self.subTest(actor=actor, action=action):
                source = (
                    f"[PAGE 1]\n{actor} wait by the gate.\n{action}\n"
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
                decoded, reason = cv._decode_grounded_detail_value(
                    {
                        "classification": "supported",
                        "checks": [
                            {
                                "field": "actor",
                                "source_id": "row_001:actor:p001-l001",
                                "supports": True,
                            },
                            {
                                "field": "action",
                                "source_id": "row_001:action:p001-l002",
                                "supports": True,
                            },
                        ],
                        "note": "Both agents are explicitly claimed.",
                    },
                    row,
                    source,
                )

                self.assertIsNotNone(decoded)
                self.assertIsNone(reason)

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

    def test_actor_anchor_uses_primary_identity_not_parenthetical_context(self):
        for actor, excerpt in (
            (
                "Los Chavos (Tony, Rony, Richie-ony, Mony, Cony)",
                "Los Chavos toman sus lugares y comienza el musical.",
            ),
            (
                "Lucyfer (Juanito's wife)",
                "Lucyfer levanta la prueba positiva de embarazo.",
            ),
            (
                "Richie (from Los Chavos)",
                "Richie se lanza sobre Lucesita.",
            ),
            (
                "Juanito",
                "Es el turno de Juanito. Juanito está paralizado.",
            ),
        ):
            with self.subTest(actor=actor):
                self.assertIsNone(cv._sequence_anchor_actor_reason(
                    {"actor": actor}, "action", excerpt
                ))

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
                "Diego",
                "Diego knows Carlos cheated in the contest.",
            ),
            (
                "Diego interroga a Carlos sobre el concurso.",
                "Carlos sabe que Diego hizo trampa en el concurso.",
                "Diego",
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
                "actor": "Diego",
                "action": "Diego questions Carlos about the contest.",
                "field": "character_knowledge",
                "claim": "Diego knows Carlos murdered Ana.",
                "source_field": "Diego knows Carlos greeted Ana.",
            },
            {
                "actor": "Diego",
                "action": "Diego pregunta a Carlos sobre el concurso.",
                "field": "character_knowledge",
                "claim": "Diego sabe que Carlos golpeó a Ana.",
                "source_field": "Diego sabe que Carlos abrazó a Ana.",
            },
            {
                "actor": "Diego",
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
                    or "numeric fact" in str(reason)
                    or "does not stage the beat actor" in str(reason),
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
            "property_count": 44,
            "optional_parameter_count": 4,
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
            max_calls=4,
        )

        self.assertEqual(len(rows), 59)
        self.assertEqual(report["status"], "needs_review")
        self.assertIn(
            "guard.existing_evidence",
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
        coverage["story_spine"]["climax"] = (
            "Richie chooses Lucesita before Diego plays the exposé and "
            "overturns the corrupt result."
        )
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
        coda = copy.deepcopy(expose)
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

    def test_structurally_weak_sequence_uses_bounded_literal_pass(self):
        coverage = valid_coverage()
        bad_core = provider_audit_core(coverage)
        bad_core["sequence_ledger"]["tag"] = []
        good_core = provider_audit_core(coverage)
        good_normalized = cv.normalize_audit_tool_input(
            copy.deepcopy(good_core), range(1, 7)
        )
        transport = FakeTransport([
            (coverage, settled_usage()),
            (bad_core, settled_usage()),
            (
                {"sequence_ledger": good_core["sequence_ledger"]},
                settled_usage(),
            ),
            (
                supported_detail_payload(coverage, good_normalized),
                settled_usage(),
            ),
        ])

        report, _usage = run_engine(new_store(), transport)

        self.assertEqual(report["status"], "sealed")
        self.assertEqual(
            [call["stage"] for call in transport.calls],
            [
                "coverage_v1.coverage",
                "coverage_v1.fact_audit",
                "coverage_v1.literal_sequence_retry",
                "coverage_v1.fact_audit_details",
            ],
        )
        retry = transport.calls[2]
        self.assertEqual(retry["model_key"], "sonnet")
        self.assertEqual(
            retry["tool"]["name"], "submit_literal_sequence_v1_2"
        )
        self.assertEqual(
            retry["max_tokens"], cv.LITERAL_SEQUENCE_MAX_TOKENS
        )
        prompt = "\n".join(
            str(block.get("text", "")) for block in retry["user_blocks"]
        )
        self.assertIn("one actor-action-result change per row", prompt)
        self.assertIn("relationship reversal before the decisive exposure", prompt)
        self.assertIn("official corrected result or trophy", prompt)
        self.assertNotIn("# SCREENPLAY TEXT", prompt)

    def test_cosquillitas_correction_inventory_is_source_bound_and_ordered(self):
        inventory = cosquillitas_literal_inventory()

        self.assertEqual(
            [stage["stage_id"] for stage in inventory],
            [
                "climax.001.chavos_perfect_score",
                "climax.002.cosquillitas_enter_hostile_stage",
                "climax.003.performance_changes_crowd",
                "climax.004.juanito_freezes",
                "climax.005.javierin_steps_forward",
                "climax.006.juanito_raw_voice",
                "climax.007.angelic_voice_and_ovation",
                "climax.008.first_three_scores",
                "climax.009.final_score_and_chavos_win",
                "climax.010.chavos_taunt_rejected",
                "climax.011.richie_declares_love",
                "climax.012.lucesita_kisses_richie",
                "climax.013.wig_reveal_and_payoff",
                "climax.014.dante_tony_video_exposure",
                "climax.015.dante_tony_escape_blocked",
                "climax.016.judges_bribes_exposed",
                "climax.017.judges_captured",
                "climax.018.trophy_awarded_to_cosquillitas",
                "ending.001.richie_private_video_continues",
                "ending.002.group_reunion_and_chavos_removed",
                "ending.003.juanito_explains_voice",
                "ending.004.pregnancy_reveal",
                "ending.005.vehicle_prize",
                "ending.006.peso_three_dollars",
                "ending.007.anita_father_returns",
                "ending.008.world_peace_announced",
                "ending.009.cure_announced",
                "ending.010.cure_retracted",
                "final_scene.001.celebration_theme",
                "final_scene.002.audience_requests_encore",
                "final_scene.003.otra_encore",
                "tag.001.y_ya",
                "aftermath.001.not_present",
            ],
        )
        self.assertEqual(inventory[0]["page"], 89)
        self.assertEqual(inventory[0]["required_digit_counts"], {"10": 4})
        self.assertEqual(
            [
                stage["stage_id"] for stage in inventory
                if stage["page"] == 97
            ],
            [
                "climax.014.dante_tony_video_exposure",
                "climax.015.dante_tony_escape_blocked",
                "climax.016.judges_bribes_exposed",
                "climax.017.judges_captured",
                "climax.018.trophy_awarded_to_cosquillitas",
            ],
        )
        self.assertEqual(
            [
                stage["stage_id"] for stage in inventory
                if stage["page"] == 100
            ],
            [
                "ending.006.peso_three_dollars",
                "ending.007.anita_father_returns",
                "ending.008.world_peace_announced",
                "ending.009.cure_announced",
                "ending.010.cure_retracted",
            ],
        )
        currency = inventory[23]
        self.assertEqual(currency["required_digit_counts"], {"3": 1})
        self.assertEqual(currency["required_concepts"], ["currency"])
        self.assertEqual(
            [
                stage["stage_id"] for stage in inventory
                if stage["requires_negation"]
            ],
            [
                "climax.004.juanito_freezes",
                "climax.011.richie_declares_love",
                "ending.010.cure_retracted",
            ],
        )
        for stage in inventory:
            for source_id in stage["source_ids"]:
                self.assertIsNotNone(
                    cv._sequence_source_anchor(
                        COSQUILLITAS_LITERAL_SOURCE, source_id
                    )
                )

    def test_source_bound_correction_rejects_missing_duplicate_and_reorder(self):
        candidate = cosquillitas_literal_candidate()
        inventory = cosquillitas_literal_inventory()
        response = cosquillitas_literal_correction(candidate, inventory)

        merged = cv._merge_literal_sequence_correction(
            candidate,
            response,
            inventory,
            range(1, 102),
            COSQUILLITAS_LITERAL_SOURCE,
        )
        self.assertEqual(merged["sequence_ledger"][0]["page"], 89)

        missing_opening = copy.deepcopy(response)
        missing_opening["sequence_ledger"]["climax"].pop(0)
        collapsed_capture = copy.deepcopy(response)
        collapsed_capture["sequence_ledger"]["climax"].pop(16)
        duplicate = copy.deepcopy(response)
        duplicate["sequence_ledger"]["climax"][16]["stage_id"] = (
            duplicate["sequence_ledger"]["climax"][15]["stage_id"]
        )
        richie_after_exposure = copy.deepcopy(response)
        rows = richie_after_exposure["sequence_ledger"]["climax"]
        rows[10], rows[13] = rows[13], rows[10]
        for label, changed in (
            ("missing p.89", missing_opening),
            ("collapsed p.97", collapsed_capture),
            ("duplicate stage", duplicate),
            ("Richie after exposure", richie_after_exposure),
        ):
            with self.subTest(label=label), self.assertRaisesRegex(
                cv.CoverageContractError,
                "stage identity or source order",
            ):
                cv._merge_literal_sequence_correction(
                    candidate,
                    changed,
                    inventory,
                    range(1, 102),
                    COSQUILLITAS_LITERAL_SOURCE,
                )

        def row_for(payload, stage_id):
            return next(
                row
                for phase_rows in payload["sequence_ledger"].values()
                for row in phase_rows
                if row["stage_id"] == stage_id
            )

        missing_four_tens = copy.deepcopy(response)
        opening = row_for(
            missing_four_tens, "climax.001.chavos_perfect_score"
        )
        opening["action"] = "The judges give a perfect score."
        opening["result"] = "Los Chavos receive a perfect score."

        changed_four_tens = copy.deepcopy(response)
        row_for(
            changed_four_tens, "climax.001.chavos_perfect_score"
        )["action"] = "The four judges score 1, 1, 1, and 1."

        father_in_currency_stage = copy.deepcopy(response)
        currency = row_for(
            father_in_currency_stage, "ending.006.peso_three_dollars"
        )
        currency["action"] = "Anita's father returns with 3 letters."
        currency["result"] = "He seeks reconciliation."

        missing_currency_value = copy.deepcopy(response)
        currency = row_for(
            missing_currency_value, "ending.006.peso_three_dollars"
        )
        currency["action"] = "The conductor says the dollar fell."
        currency["result"] = "The currency changed."

        collapsed_exposure = copy.deepcopy(response)
        exposure = row_for(
            collapsed_exposure, "climax.014.dante_tony_video_exposure"
        )
        exposure["result"] += (
            " Security captures the judges and awards Cosquillitas the trophy."
        )

        lost_negation = copy.deepcopy(response)
        love = row_for(
            lost_negation, "climax.011.richie_declares_love"
        )
        love["action"] = "Richie says his love for Lucesita continues."

        mutations = (
            (missing_four_tens, "deleted a required numeric source fact"),
            (changed_four_tens, "deleted a required numeric source fact"),
            (father_in_currency_stage, "required source event"),
            (missing_currency_value, "deleted a required numeric source fact"),
            (collapsed_exposure, "combines a separately bound source event"),
            (lost_negation, "deleted required source polarity"),
        )
        for changed, error in mutations:
            with self.subTest(error=error), self.assertRaisesRegex(
                cv.CoverageContractError, error
            ):
                cv._merge_literal_sequence_correction(
                    candidate,
                    changed,
                    inventory,
                    range(1, 102),
                    COSQUILLITAS_LITERAL_SOURCE,
                )

        public = cv._public_sequence_ledger(merged["sequence_ledger"])
        self.assertTrue(any(
            cv._LITERAL_SEQUENCE_BINDING_KEY in row
            for row in merged["sequence_ledger"]
        ))
        self.assertTrue(all(
            cv._LITERAL_SEQUENCE_BINDING_KEY not in row for row in public
        ))

    def test_real_cosquillitas_contract_compiles_and_merges_all_claims(self):
        source = real_cosquillitas_source()
        inventory = cv.build_literal_sequence_stage_inventory(
            source, COSQUILLITAS_SOURCE_SHA256
        )

        self.assertEqual(len(inventory), 33)
        self.assertEqual(
            sum(len(stage["required_sources"]) for stage in inventory), 87
        )
        for stage in inventory:
            for field in ("action", "result"):
                expected = [
                    required["canonical_claim"]
                    for required in stage["required_sources"]
                    if required["canonical_field"] == field
                ]
                if not expected:
                    continue
                atoms = cv._sequence_material_claim_atoms({
                    field: "; ".join(expected),
                })
                self.assertEqual(
                    [(atom["field"], atom["text"]) for atom in atoms],
                    [(field, claim) for claim in expected],
                    stage["stage_id"],
                )

        candidate = cosquillitas_literal_candidate()
        response = cosquillitas_literal_correction(candidate, inventory)
        conservative_output_tokens = (
            len(json.dumps(response, ensure_ascii=False)) + 2
        ) // 3
        self.assertLessEqual(
            conservative_output_tokens,
            cv.LITERAL_SEQUENCE_CORRECTION_MAX_TOKENS,
        )
        merged = cv._merge_literal_sequence_correction(
            candidate, response, inventory, range(1, 102), source
        )
        self.assertIsNone(cv._literal_sequence_contract_problem(
            merged, source, COSQUILLITAS_SOURCE_SHA256
        ))
        legacy_core = copy.deepcopy(merged)
        for row in legacy_core["sequence_ledger"]:
            row.pop(cv._LITERAL_SEQUENCE_BINDING_KEY, None)
        self.assertIn(
            "hash-bound source",
            cv._literal_sequence_contract_problem(
                legacy_core, source, COSQUILLITAS_SOURCE_SHA256
            ),
        )
        stage_ids = [
            row[cv._LITERAL_SEQUENCE_BINDING_KEY]["stage_id"]
            for row in merged["sequence_ledger"]
            if cv._LITERAL_SEQUENCE_BINDING_KEY in row
        ]
        critical_order = [
            "climax.008.first_three_scores",
            "climax.009.final_score_and_chavos_win",
            "climax.011.richie_declares_love",
            "climax.012.lucesita_kisses_richie",
            "climax.013.wig_reveal_and_payoff",
            "climax.014.dante_tony_video_exposure",
            "climax.017.judges_captured",
            "climax.018.trophy_awarded_to_cosquillitas",
        ]
        self.assertEqual(
            [stage_id for stage_id in stage_ids if stage_id in critical_order],
            critical_order,
        )

        def bound_row(stage_id):
            return next(
                row for row in merged["sequence_ledger"]
                if row.get(cv._LITERAL_SEQUENCE_BINDING_KEY, {}).get(
                    "stage_id"
                ) == stage_id
            )

        chavos_score = bound_row("climax.001.chavos_perfect_score")
        self.assertIn(
            "Los jueces muestran a Los Chavos sus calificaciones",
            chavos_score["action"],
        )
        self.assertLess(
            chavos_score["action"].index("Los jueces muestran"),
            chavos_score["action"].index("10, 10, 10, 10"),
        )
        pregnancy = bound_row("ending.004.pregnancy_reveal")
        self.assertLess(
            pregnancy["action"].index("JUANITO repite"),
            pregnancy["action"].index("Lucyfer corre"),
        )
        encore = bound_row("final_scene.002.audience_requests_encore")
        self.assertLess(
            encore["action"].index("El público se vuelve loco"),
            encore["action"].index("El público pide otra canción"),
        )

        public = cv._public_sequence_ledger(merged["sequence_ledger"])
        exposure = next(
            row for row in public
            if "conversación de Dante con Tony" in row["action"]
        )
        self.assertIn(
            "video falso que incrimina a Cosquillitas", exposure["action"]
        )
        bribes = next(
            row for row in public if "un primer juez" in row["action"]
        )
        bribe_text = " ".join(
            str(bribes[field]) for field in ("actor", "action", "result")
        ).casefold()
        self.assertIn("otro recibe", bribe_text)
        for unsupported in (
            "all judges", "four judges", "todos los jueces", "cuatro jueces"
        ):
            self.assertNotIn(unsupported, bribe_text)

        def response_row(payload, stage_id):
            return next(
                row
                for phase_rows in payload["sequence_ledger"].values()
                for row in phase_rows
                if row["stage_id"] == stage_id
            )

        added_obligations = {
            "p093-l008-l009": (
                "result", "Los oyentes se empiezan a destapar los oídos."
            ),
            "p093-l017-l018": (
                "result", "No pueden creer lo ocurrido."
            ),
            "p097-l026-l027": (
                "action", "Los Jueces se paran de sus asientos."
            ),
            "p097-l030-l034": (
                "action",
                "La disculpa responde a haber hecho pasar a Cosquillitas "
                "por la peor semana de sus vidas.",
            ),
            "p099-l027-l028": (
                "action", "Lucyfer corre hacia Juanito."
            ),
            "p100-l010-l015": (
                "action",
                "El regreso busca enmendar todo aunque ya sea innecesario.",
            ),
            "p101-l011-l013": (
                "action", "El público se vuelve loco."
            ),
        }
        for source_id, (field, claim) in added_obligations.items():
            stage = next(
                stage for stage in inventory
                if any(
                    required["source_id"] == source_id
                    and required["canonical_field"] == field
                    and required["canonical_claim"] == claim
                    for required in stage["required_sources"]
                )
            )
            siblings = [
                required for required in stage["required_sources"]
                if required["source_id"] == source_id
            ]
            self.assertEqual(len(siblings), 2, source_id)
            self.assertEqual(
                [required["obligation_id"] for required in siblings],
                [f"{source_id}.o01", f"{source_id}.o02"],
            )

            changed = copy.deepcopy(response)
            changed_row = response_row(changed, stage["stage_id"])
            clauses = changed_row[field].split("; ")
            clauses.remove(claim)
            changed_row[field] = "; ".join(clauses)
            with self.subTest(source_id=source_id), self.assertRaisesRegex(
                cv.CoverageContractError,
                "changed, moved, reordered, or omitted a canonical source claim",
            ):
                cv._merge_literal_sequence_correction(
                    candidate, changed, inventory, range(1, 102), source
                )

        omitted = copy.deepcopy(response)
        ovation = next(
            stage for stage in inventory
            if stage["stage_id"] == "climax.007.angelic_voice_and_ovation"
        )
        rony_claim = next(
            required["canonical_claim"]
            for required in ovation["required_sources"]
            if required["source_id"] == "p093-l027"
        )
        ovation_row = response_row(
            omitted, "climax.007.angelic_voice_and_ovation"
        )
        ovation_row["result"] = ovation_row["result"].replace(
            f"; {rony_claim}", ""
        )

        moved = copy.deepcopy(response)
        exposure_row = response_row(
            moved, "climax.014.dante_tony_video_exposure"
        )
        canonical_exposure = exposure_row["action"]
        exposure_row["action"] = exposure_row["result"]
        exposure_row["result"] = (
            canonical_exposure + "; " + exposure_row["result"]
        )

        reordered = copy.deepcopy(response)
        ovation_row = response_row(
            reordered, "climax.007.angelic_voice_and_ovation"
        )
        ovation_row["result"] = "; ".join(reversed(
            ovation_row["result"].split("; ")
        ))

        for label, changed in (
            ("omitted p.93 source fact", omitted),
            ("moved p.97 source fact", moved),
            ("reordered p.93 source facts", reordered),
        ):
            with self.subTest(label=label), self.assertRaisesRegex(
                cv.CoverageContractError,
                "changed, moved, reordered, or omitted a canonical source "
                "claim",
            ):
                cv._merge_literal_sequence_correction(
                    candidate, changed, inventory, range(1, 102), source
                )

        changed_actor = copy.deepcopy(response)
        richie = next(
            row for row in changed_actor["sequence_ledger"]["climax"]
            if row["stage_id"] == "climax.011.richie_declares_love"
        )
        richie["actor"] = "Richie (murders Juanito)"
        with self.assertRaisesRegex(
            cv.CoverageContractError, "changed its canonical actor"
        ):
            cv._merge_literal_sequence_correction(
                candidate, changed_actor, inventory, range(1, 102), source
            )

    def test_real_cosquillitas_p93_p94_detail_is_atom_authoritative(self):
        source = real_cosquillitas_source()
        inventory = cv.build_literal_sequence_stage_inventory(
            source, COSQUILLITAS_SOURCE_SHA256
        )
        candidate = cosquillitas_literal_candidate()
        merged = cv._merge_literal_sequence_correction(
            candidate,
            cosquillitas_literal_correction(candidate, inventory),
            inventory,
            range(1, 102),
            source,
        )
        rows = cv.build_detail_audit_rows(
            {}, [], merged["sequence_ledger"]
        )

        for stage_id, required_count in (
            ("climax.007.angelic_voice_and_ovation", 8),
            ("climax.008.first_three_scores", 3),
        ):
            with self.subTest(stage_id=stage_id):
                row = next(
                    value for value in rows
                    if value["kind"] == "sequence_evidence"
                    and value["subject"].get(
                        "literal_source_binding", {}
                    ).get("stage_id") == stage_id
                )
                subject = row["subject"]
                binding = subject["literal_source_binding"]
                required_by_claim = {
                    (
                        required["canonical_field"],
                        required["canonical_claim"],
                    ): required
                    for required in binding["required_sources"]
                }
                atom_ids_by_obligation = {}
                material_results = []
                for atom in subject["material_claim_atoms"]:
                    required = required_by_claim.get(
                        (atom["field"], atom["text"])
                    )
                    if required is None:
                        material_results.append({
                            "atom_id": atom["atom_id"],
                            "disposition": "not_located",
                            "source_id": cv.SEQUENCE_SOURCE_NOT_LOCATED,
                        })
                        continue
                    atom_ids_by_obligation[
                        required["obligation_id"]
                    ] = atom["atom_id"]
                    material_results.append({
                        "atom_id": atom["atom_id"],
                        "disposition": "supported",
                        "source_id": (
                            f"{row['slot']}:{atom['atom_id']}:"
                            f"{required['source_id']}"
                        ),
                    })
                value = {
                    "classification": "partially_supported",
                    "checks": [
                        {
                            "field": field,
                            "source_id": cv.SEQUENCE_SOURCE_NOT_LOCATED,
                            "supports": False,
                        }
                        for field in subject["required_fields"]
                    ],
                    "note": "Canonical material facts are source-bound.",
                    "material_atom_results": material_results,
                    "required_source_results": [
                        f"{required['obligation_id']}|"
                        f"{atom_ids_by_obligation[required['obligation_id']]}"
                        for required in binding["required_sources"]
                    ],
                }

                decoded, reason = cv._decode_grounded_detail_value(
                    value, row, source
                )

                self.assertIsNone(reason)
                self.assertEqual(decoded["classification"], "partially_supported")
                represented = decoded["required_source_results"]
                self.assertEqual(len(represented), required_count)
                self.assertTrue(all(item["represented"] for item in represented))

        out_of_order = cosquillitas_literal_correction(candidate, inventory)
        angelic = next(
            value for value in out_of_order["sequence_ledger"]["climax"]
            if value["stage_id"]
            == "climax.007.angelic_voice_and_ovation"
        )
        angelic["result"] = "Juan abre los ojos.; " + angelic["result"]
        merged = cv._merge_literal_sequence_correction(
            candidate, out_of_order, inventory, range(1, 102), source
        )
        row = next(
            value for value in cv.build_detail_audit_rows(
                {}, [], merged["sequence_ledger"]
            )
            if value["kind"] == "sequence_evidence"
            and value["subject"].get(
                "literal_source_binding", {}
            ).get("stage_id") == "climax.007.angelic_voice_and_ovation"
        )
        subject = row["subject"]
        binding = subject["literal_source_binding"]
        required_by_claim = {
            (required["canonical_field"], required["canonical_claim"]): required
            for required in binding["required_sources"]
        }
        atom_ids_by_obligation = {}
        material_results = []
        for atom in subject["material_claim_atoms"]:
            required = required_by_claim.get((atom["field"], atom["text"]))
            source_id = (
                required["source_id"] if required is not None
                else "p093-l014"
            )
            if required is not None:
                atom_ids_by_obligation[
                    required["obligation_id"]
                ] = atom["atom_id"]
            material_results.append({
                "atom_id": atom["atom_id"],
                "disposition": "supported",
                "source_id": (
                    f"{row['slot']}:{atom['atom_id']}:{source_id}"
                ),
            })
        value = {
            "classification": "partially_supported",
            "checks": [
                {
                    "field": field,
                    "source_id": cv.SEQUENCE_SOURCE_NOT_LOCATED,
                    "supports": False,
                }
                for field in subject["required_fields"]
            ],
            "note": "All atoms are supported but their source order is wrong.",
            "material_atom_results": material_results,
            "required_source_results": [
                f"{required['obligation_id']}|"
                f"{atom_ids_by_obligation[required['obligation_id']]}"
                for required in binding["required_sources"]
            ],
        }

        decoded, reason = cv._decode_grounded_detail_value(
            value, row, source
        )

        self.assertIsNone(decoded)
        self.assertIn("reverse source order", reason)

    def test_universal_judge_claim_requires_universal_source_evidence(self):
        source = (
            "El video muestra regalos al primero y al otro juez."
        )

        self.assertFalse(cv._sequence_numeric_claim_matches(
            "Todos los jueces reciben regalos.", source
        ))
        self.assertFalse(cv._sequence_numeric_claim_matches(
            "All judges receive gifts.", source
        ))
        self.assertTrue(cv._sequence_numeric_claim_matches(
            "Un primer juez y otro juez reciben regalos.", source
        ))

    def test_literal_stage_binding_rejects_sibling_source_provenance(self):
        candidate = cosquillitas_literal_candidate()
        inventory = cosquillitas_literal_inventory()
        merged = cv._merge_literal_sequence_correction(
            candidate,
            cosquillitas_literal_correction(candidate, inventory),
            inventory,
            range(1, 102),
            COSQUILLITAS_LITERAL_SOURCE,
        )
        exposure = next(
            row for row in merged["sequence_ledger"]
            if row[cv._LITERAL_SEQUENCE_BINDING_KEY]["stage_id"]
            == "climax.014.dante_tony_video_exposure"
        )
        detail_row = next(
            row for row in cv.build_detail_audit_rows(
                {}, [], merged["sequence_ledger"]
            )
            if row["kind"] == "sequence_evidence"
            and row["subject"]["beat"]["order"] == exposure["order"]
        )
        capture_source = next(
            stage["source_ids"][0] for stage in inventory
            if stage["stage_id"] == "climax.017.judges_captured"
        )
        checks = []
        for field in cv.GROUNDED_SEQUENCE_FIELDS:
            source_id = (
                f"{detail_row['slot']}:{field}:{capture_source}"
                if field == "action" else cv.SEQUENCE_SOURCE_NOT_LOCATED
            )
            checks.append({
                "field": field,
                "source_id": source_id,
                "supports": field == "action",
            })
        value = {
            "classification": "unsupported",
            "checks": checks,
            "note": "The exposure row cannot borrow capture evidence.",
        }

        decoded, error = cv._decode_grounded_detail_value(
            value, detail_row, COSQUILLITAS_LITERAL_SOURCE
        )

        self.assertIsNone(decoded)
        self.assertIn("outside its engine-bound literal stage", error)

    def test_literal_stage_contract_fails_closed_on_unknown_or_changed_source(self):
        with self.assertRaisesRegex(
            cv.CoverageContractError, "no hash-bound source contract"
        ):
            cv.build_literal_sequence_stage_inventory(
                COSQUILLITAS_LITERAL_SOURCE, "0" * 64
            )

        contract = cosquillitas_literal_contract(
            COSQUILLITAS_LITERAL_SOURCE
        )
        contract["normalized_text_sha256"] = "0" * 64
        with (
            patch.object(
                cv, "_load_literal_sequence_contract", return_value=contract
            ),
            self.assertRaisesRegex(
                cv.CoverageContractError, "does not match this screenplay"
            ),
        ):
            cv.build_literal_sequence_stage_inventory(
                COSQUILLITAS_LITERAL_SOURCE, "f" * 64
            )

    def test_literal_correction_settlement_replays_without_rebuy(self):
        coverage = valid_coverage()
        bad_core = provider_audit_core(coverage)
        bad_core["sequence_ledger"]["tag"] = []
        good_core = provider_audit_core(coverage)
        good_normalized = cv.normalize_audit_tool_input(
            copy.deepcopy(good_core), range(1, 7)
        )
        inventory = []
        correction = {"sequence_ledger": {
            phase: [] for phase in cv.AUDIT_SEQUENCE_PHASES
        }}
        for phase in cv.AUDIT_SEQUENCE_PHASES:
            row = copy.deepcopy(good_core["sequence_ledger"][phase][0])
            stage = {
                "stage_id": f"{phase}:fixture",
                "kind": f"{phase}_fixture",
                "phase": phase,
                "canonical_actor": row["actor"],
                "source_ids": [f"p{row['page']:03d}-l001"],
                "page": row["page"],
                "source_excerpts": ["fixture"],
            }
            inventory.append(stage)
            row["stage_id"] = stage["stage_id"]
            correction["sequence_ledger"][phase].append(row)
        rejected = {"sequence_ledger": good_core["sequence_ledger"]}
        store = new_store()
        first = FakeTransport([
            (coverage, settled_usage()),
            (bad_core, settled_usage()),
            (rejected, settled_usage()),
            (correction, settled_usage()),
        ])
        rejection = cv.CoverageContractError(
            "Literal sequence retry omitted or collapsed prior material "
            "events: fixture"
        )
        with (
            patch.object(
                cv,
                "build_literal_sequence_stage_inventory",
                return_value=inventory,
            ),
            patch.object(
                cv, "_merge_literal_sequence_retry", side_effect=rejection
            ),
            patch.object(
                cv,
                "_merge_literal_sequence_correction",
                side_effect=RuntimeError("crash after correction settlement"),
            ),
            self.assertRaisesRegex(RuntimeError, "after correction settlement"),
        ):
            run_engine(store, first, max_cost_usd=5.0)

        self.assertEqual(
            [call["stage"] for call in first.calls],
            [
                "coverage_v1.coverage",
                "coverage_v1.fact_audit",
                "coverage_v1.literal_sequence_retry",
                "coverage_v1.literal_sequence_correction",
            ],
        )
        self.assertEqual(
            first.calls[2]["max_tokens"], cv.LITERAL_SEQUENCE_MAX_TOKENS
        )
        self.assertEqual(
            first.calls[3]["max_tokens"],
            cv.LITERAL_SEQUENCE_CORRECTION_MAX_TOKENS,
        )
        [checkpoint] = list(
            store.root.glob("*/literal_sequence_correction_request.json")
        )
        checkpoint_record = json.loads(checkpoint.read_text(encoding="utf-8"))
        checkpoint_payload = checkpoint_record["payload"]
        self.assertEqual(
            checkpoint_payload["contract_version"],
            cv.LITERAL_SEQUENCE_CORRECTION_CHECKPOINT_VERSION,
        )
        [receipts_path] = list(store.root.glob("*/call_receipts.json"))
        receipts = json.loads(receipts_path.read_text(encoding="utf-8"))[
            "payload"
        ]["receipts"]
        fingerprints_by_stage = {
            receipt["stage"]: fingerprint
            for fingerprint, receipt in receipts.items()
        }
        self.assertEqual(
            checkpoint_payload["first_retry_fingerprint"],
            fingerprints_by_stage["coverage_v1.literal_sequence_retry"],
        )
        self.assertEqual(
            checkpoint_payload["correction_request_fingerprint"],
            fingerprints_by_stage["coverage_v1.literal_sequence_correction"],
        )
        current_checkpoint_payload = copy.deepcopy(checkpoint_payload)
        legacy_checkpoint_payload = copy.deepcopy(checkpoint_payload)
        legacy_checkpoint_payload.update({
            "contract_version": (
                cv.PRIOR_LITERAL_SEQUENCE_CORRECTION_CHECKPOINT_VERSION
            ),
            "inventory_sha256": "1" * 64,
            "source_focus_sha256": "2" * 64,
            "correction_request_fingerprint": "3" * 64,
        })
        self.assertTrue(
            cv._is_prior_literal_sequence_correction_checkpoint(
                legacy_checkpoint_payload, current_checkpoint_payload
            )
        )
        for field in (
            "first_retry_fingerprint", "rejected_payload_sha256"
        ):
            with self.subTest(field=field):
                changed_lineage = copy.deepcopy(legacy_checkpoint_payload)
                changed_lineage[field] = "4" * 64
                self.assertFalse(
                    cv._is_prior_literal_sequence_correction_checkpoint(
                        changed_lineage, current_checkpoint_payload
                    )
                )
        checkpoint.write_text(
            json.dumps(
                cv._sealed_record(
                    checkpoint_record["binding"], legacy_checkpoint_payload
                ),
                sort_keys=True,
            ),
            encoding="utf-8",
        )

        resume = FakeTransport([(
            supported_detail_payload(coverage, good_normalized),
            settled_usage(),
        )])
        with (
            patch.object(
                cv,
                "build_literal_sequence_stage_inventory",
                return_value=inventory,
            ),
            patch.object(
                cv, "_merge_literal_sequence_retry", side_effect=rejection
            ),
            patch.object(
                cv,
                "_merge_literal_sequence_correction",
                return_value=good_normalized,
            ),
        ):
            report, _usage = run_engine(store, resume, max_cost_usd=5.0)

        self.assertEqual(report["status"], "sealed")
        self.assertEqual(len(resume.calls), 1)
        self.assertEqual(
            resume.calls[0]["stage"], "coverage_v1.fact_audit_details"
        )
        migrated_payload = json.loads(
            checkpoint.read_text(encoding="utf-8")
        )["payload"]
        self.assertEqual(migrated_payload, current_checkpoint_payload)

    def test_legacy_audit_core_routes_through_source_contract_without_rebuy(self):
        coverage = valid_coverage()
        core = provider_audit_core(coverage)
        store = new_store()
        stop = RuntimeError("stop after audit core checkpoint")
        first = FakeTransport([
            (coverage, settled_usage()),
            (core, settled_usage()),
            stop,
        ])
        with self.assertRaisesRegex(RuntimeError, "audit core checkpoint"):
            run_engine(store, first, max_cost_usd=5.0)

        normalized = cv.normalize_audit_tool_input(
            copy.deepcopy(core), range(1, 7)
        )
        inventory = [
            {
                "stage_id": f"{phase}.fixture",
                "phase": phase,
                "canonical_actor": rows[0]["actor"],
                "source_ids": ["p006-l003"],
                "required_source_ids": ["p006-l003"],
                "required_obligation_ids": ["p006-l003.o01"],
                "required_sources": [],
                "required_digit_counts": {},
                "required_concepts": [],
                "requires_negation": False,
                "allowed_concepts": [],
                "page": rows[0]["page"],
                "source_excerpts": ["fixture"],
            }
            for phase, rows in core["sequence_ledger"].items()
        ]
        bound = {**normalized, "_fixture_bound": True}

        def contract_problem(payload, _text, _content_sha256):
            return None if payload.get("_fixture_bound") else (
                "sequence_ledger lacks current hash-bound source bindings"
            )

        retry = {"sequence_ledger": copy.deepcopy(core["sequence_ledger"])}
        correction = {"sequence_ledger": {
            phase: [] for phase in cv.AUDIT_SEQUENCE_PHASES
        }}
        resume = FakeTransport([
            (retry, settled_usage()),
            (correction, settled_usage()),
            RuntimeError("stop before fresh detail"),
        ])
        with (
            patch.object(
                cv,
                "_literal_sequence_contract_problem",
                side_effect=contract_problem,
            ),
            patch.object(
                cv,
                "build_literal_sequence_stage_inventory",
                return_value=inventory,
            ),
            patch.object(
                cv,
                "_merge_literal_sequence_correction",
                return_value=bound,
            ),
            self.assertRaisesRegex(RuntimeError, "fresh detail"),
        ):
            run_engine(store, resume, max_cost_usd=5.0)

        self.assertEqual(
            [call["stage"] for call in resume.calls],
            [
                "coverage_v1.literal_sequence_retry",
                "coverage_v1.literal_sequence_correction",
                "coverage_v1.fact_audit_details",
            ],
        )

    def test_literal_sequence_schema_can_preserve_call12_stage_count(self):
        phase = cv.LITERAL_SEQUENCE_TOOL["input_schema"]["properties"][
            "sequence_ledger"
        ]["properties"]["climax"]

        self.assertGreaterEqual(
            phase["maxItems"], len(CALL12_FIXTURE["literal_climax_and_ending"])
        )

    def test_call12_literal_climax_order_survives_same_page_beats(self):
        labels = CALL12_FIXTURE["literal_climax_and_ending"]
        pages = [89, 90, 92, 92, 92, 93, 95, 96, 97, 97, 98, 100, 101]

        def beat(label, page):
            return {
                "actor": "The named screenplay actor",
                "action": label,
                "result": label,
                "character_knowledge": "The actor knows that the beat occurred.",
                "audience_knowledge": "The audience sees the beat occur.",
                "page": page,
            }

        response = {"sequence_ledger": {
            "climax": [
                beat(label, page)
                for label, page in zip(labels[:11], pages[:11])
            ],
            "ending": [beat(labels[11], pages[11])],
            "final_scene": [beat(labels[12], pages[12])],
            "tag": [{
                **beat("NOT PRESENT", 101),
                **{field: "NOT PRESENT" for field in cv.GROUNDED_SEQUENCE_FIELDS},
            }],
            "aftermath": [{
                **beat("NOT PRESENT", 101),
                **{field: "NOT PRESENT" for field in cv.GROUNDED_SEQUENCE_FIELDS},
            }],
        }}

        merged = cv._merge_literal_sequence_retry(
            {"verdicts": []}, response, range(1, 102), SCREENPLAY_TEXT
        )

        self.assertEqual(
            [row["action"] for row in merged["sequence_ledger"][:13]],
            labels,
        )

    def test_literal_retry_cannot_drop_richie_or_actorless_climax_events(self):
        labels = CALL12_FIXTURE["literal_climax_and_ending"]
        pages = [89, 90, 92, 92, 92, 93, 95, 96, 97, 97, 98, 100, 101]

        def beat(label, page):
            return {
                "actor": "The screenplay actor",
                "action": label,
                "result": label,
                "character_knowledge": "The actor knows that the beat occurred.",
                "audience_knowledge": "The audience sees the beat occur.",
                "page": page,
            }

        response = {"sequence_ledger": {
            "climax": [
                beat(label, page)
                for label, page in zip(labels[:11], pages[:11])
            ],
            "ending": [beat(labels[11], pages[11])],
            "final_scene": [beat(labels[12], pages[12])],
            "tag": [{
                **beat("NOT PRESENT", 101),
                **{
                    field: "NOT PRESENT"
                    for field in cv.GROUNDED_SEQUENCE_FIELDS
                },
            }],
            "aftermath": [{
                **beat("NOT PRESENT", 101),
                **{
                    field: "NOT PRESENT"
                    for field in cv.GROUNDED_SEQUENCE_FIELDS
                },
            }],
        }}
        candidate = cv._merge_literal_sequence_retry(
            {"verdicts": []}, response, range(1, 102), SCREENPLAY_TEXT
        )

        for label in (
            labels[7],  # Richie declaration, kiss, and wig reveal.
            labels[9],  # Gifts and capture, no proper actor required.
            labels[10],  # Official trophy result.
        ):
            shortened = copy.deepcopy(response)
            shortened["sequence_ledger"]["climax"] = [
                row
                for row in shortened["sequence_ledger"]["climax"]
                if row["action"] != label
            ]
            with self.subTest(omitted=label), self.assertRaisesRegex(
                cv.CoverageContractError,
                "omitted or collapsed prior material events",
            ):
                cv._merge_literal_sequence_retry(
                    candidate, shortened, range(1, 102), SCREENPLAY_TEXT
                )

        relocated = copy.deepcopy(response)
        trophy = next(
            row
            for row in relocated["sequence_ledger"]["climax"]
            if row["action"] == labels[10]
        )
        relocated["sequence_ledger"]["climax"].remove(trophy)
        relocated["sequence_ledger"]["ending"].insert(0, trophy)
        with self.assertRaisesRegex(
            cv.CoverageContractError,
            "omitted or collapsed prior material events",
        ):
            cv._merge_literal_sequence_retry(
                candidate, relocated, range(1, 102), SCREENPLAY_TEXT
            )

    def test_literal_retry_cannot_substitute_another_true_video_event(self):
        source_text = SCREENPLAY_TEXT + (
            "\nThe screen reveals the bribery footage.\n"
            "The bribery is exposed.\n"
            "The screen reveals the vacation footage.\n"
            "The vacation is exposed.\n"
            "The screen reveals vacation footage; the bribery continues.\n"
            "The screen reveals vacation footage after the bribery.\n"
            "The vacation is exposed after the bribery.\n"
            "The screen reveals vacation footage amid the bribery.\n"
            "The vacation is exposed amid the bribery.\n"
            "The screen reveals vacation footage; the bribery is mentioned.\n"
        )
        prior = provider_audit_core(valid_coverage())
        prior["sequence_ledger"]["climax"][0].update({
            "actor": "The screen",
            "action": "The screen reveals the bribery footage.",
            "result": "The bribery is exposed.",
            "character_knowledge": "The judges know the bribery is exposed.",
            "audience_knowledge": "The audience sees the bribery footage.",
        })
        candidate = cv._merge_literal_sequence_retry(
            {"verdicts": []},
            {"sequence_ledger": prior["sequence_ledger"]},
            range(1, 7),
            source_text,
        )
        for action, result in (
            (
                "The screen reveals the vacation footage.",
                "The vacation is exposed.",
            ),
            (
                "The screen reveals vacation footage; the bribery continues.",
                "The vacation is exposed.",
            ),
            (
                "The screen reveals vacation footage after the bribery.",
                "The vacation is exposed after the bribery.",
            ),
            (
                "The screen reveals vacation footage amid the bribery.",
                "The vacation is exposed amid the bribery.",
            ),
            (
                "The screen reveals vacation footage; the bribery is mentioned.",
                "The bribery is exposed.",
            ),
        ):
            repaired = copy.deepcopy(prior)
            repaired["sequence_ledger"]["climax"][0].update({
                "action": action,
                "result": result,
                "character_knowledge": (
                    "The judges know the vacation is exposed."
                ),
                "audience_knowledge": (
                    "The audience sees the vacation footage."
                ),
            })

            with self.subTest(action=action), self.assertRaisesRegex(
                cv.CoverageContractError,
                "omitted or collapsed prior material events",
            ):
                cv._merge_literal_sequence_retry(
                    candidate,
                    {"sequence_ledger": repaired["sequence_ledger"]},
                    range(1, 7),
                    source_text,
                )

    def test_literal_retry_cannot_reverse_actorless_event_relations(self):
        source_text = SCREENPLAY_TEXT + """
The car hits the bus.
The bus is damaged by the car.
The bus hits the car.
The car is damaged by the bus.
"""
        prior = provider_audit_core(valid_coverage())
        prior["sequence_ledger"]["climax"][0].update({
            "actor": "The car",
            "action": "The car hits the bus.",
            "result": "The bus is damaged by the car.",
            "character_knowledge": "The driver knows the bus was hit.",
            "audience_knowledge": "The audience sees the car hit the bus.",
        })
        candidate = cv._merge_literal_sequence_retry(
            {"verdicts": []},
            {"sequence_ledger": prior["sequence_ledger"]},
            range(1, 7),
            source_text,
        )
        repaired = copy.deepcopy(prior)
        repaired["sequence_ledger"]["climax"][0].update({
            "actor": "The bus",
            "action": "The bus hits the car.",
            "result": "The car is damaged by the bus.",
            "character_knowledge": "The driver knows the car was hit.",
            "audience_knowledge": "The audience sees the bus hit the car.",
        })

        with self.assertRaisesRegex(
            cv.CoverageContractError,
            "omitted or collapsed prior material events",
        ):
            cv._merge_literal_sequence_retry(
                candidate,
                {"sequence_ledger": repaired["sequence_ledger"]},
                range(1, 7),
                source_text,
            )

    def test_literal_retry_cannot_move_negation_between_video_objects(self):
        prior_claim = (
            "The screen reveals not the bribery footage but the vacation "
            "footage."
        )
        reversed_claim = (
            "The screen reveals the bribery footage but not the vacation "
            "footage."
        )
        source_text = SCREENPLAY_TEXT + f"\n{prior_claim}\n{reversed_claim}\n"
        prior = provider_audit_core(valid_coverage())
        prior["sequence_ledger"]["climax"][0].update({
            "actor": "The screen",
            "action": prior_claim,
            "result": prior_claim,
            "character_knowledge": (
                "The judges know the vacation footage was shown."
            ),
            "audience_knowledge": (
                "The audience sees the vacation footage, not the bribery."
            ),
        })
        candidate = cv._merge_literal_sequence_retry(
            {"verdicts": []},
            {"sequence_ledger": prior["sequence_ledger"]},
            range(1, 7),
            source_text,
        )
        repaired = copy.deepcopy(prior)
        repaired["sequence_ledger"]["climax"][0].update({
            "action": reversed_claim,
            "result": reversed_claim,
        })

        with self.assertRaisesRegex(
            cv.CoverageContractError,
            "omitted or collapsed prior material events",
        ):
            cv._merge_literal_sequence_retry(
                candidate,
                {"sequence_ledger": repaired["sequence_ledger"]},
                range(1, 7),
                source_text,
            )

    def test_literal_retry_cannot_change_singular_role_to_plural(self):
        source_text = SCREENPLAY_TEXT + """
The judge awards the trophy.
The judge celebrates.
The judges award the trophy.
The judges celebrate.
"""
        prior = provider_audit_core(valid_coverage())
        prior["sequence_ledger"]["climax"][0].update({
            "actor": "The judge",
            "action": "The judge awards the trophy.",
            "result": "The judge celebrates.",
            "character_knowledge": "The judge knows the trophy was awarded.",
            "audience_knowledge": "The audience sees the judge celebrate.",
        })
        candidate = cv._merge_literal_sequence_retry(
            {"verdicts": []},
            {"sequence_ledger": prior["sequence_ledger"]},
            range(1, 7),
            source_text,
        )
        repaired = copy.deepcopy(prior)
        repaired["sequence_ledger"]["climax"][0].update({
            "actor": "The judges",
            "action": "The judges award the trophy.",
            "result": "The judges celebrate.",
            "character_knowledge": (
                "The judges know the trophy was awarded."
            ),
            "audience_knowledge": (
                "The audience sees the judges celebrate."
            ),
        })

        with self.assertRaisesRegex(
            cv.CoverageContractError,
            "omitted or collapsed prior material events",
        ):
            cv._merge_literal_sequence_retry(
                candidate,
                {"sequence_ledger": repaired["sequence_ledger"]},
                range(1, 7),
                source_text,
            )

    def test_literal_retry_accepts_only_exact_call2_judge_normalization(self):
        prior = {
            "order": 1,
            "phase": "climax",
            "actor": "Three judges",
            "action": (
                "Hold up scoring paletas: first judge scores 10, second "
                "scores 10, third scores 5, fourth scores 2."
            ),
            "result": (
                "Mathematical total awards Los Chavos the win despite "
                "Cosquillitas' superior emotional performance; formal "
                "announcement: 'Los nuevos reyes y ganadores del CINLTT, "
                "LOS CHAVOS!'"
            ),
            "character_knowledge": "The contestants see the scores.",
            "audience_knowledge": "The audience sees the scores.",
            "page": 93,
        }
        repaired = {
            **prior,
            "actor": "The judges",
            "action": (
                "Judge 1 scores 10; Judge 2 scores 10; "
                "Judge 3 scores 5; Judge 4 scores 2."
            ),
        }
        source = "[PAGE 93]\nFour judges display their scores.\n"

        preserved, diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [prior]},
            {"sequence_ledger": [repaired]},
            source,
        )

        self.assertTrue(preserved, diagnostics)
        changed_score = copy.deepcopy(repaired)
        changed_score["action"] = changed_score["action"].replace(
            "Judge 4 scores 2", "Judge 4 scores 3"
        )
        preserved, _diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [prior]},
            {"sequence_ledger": [changed_score]},
            source,
        )
        self.assertFalse(preserved)

    def test_literal_retry_accepts_call2_compound_row_decomposition(self):
        def beat(actor, action, result, page, order=1):
            return {
                "order": order,
                "phase": "climax",
                "actor": actor,
                "action": action,
                "result": result,
                "character_knowledge": "The characters know what happened.",
                "audience_knowledge": "The audience sees what happened.",
                "page": page,
            }

        source = (
            "[PAGE 92]\nJuanito freezes before singing.\n"
            "[PAGE 93]\nJavierin steps forward and Juanito sings.\n"
            "[PAGE 94]\nThe judges score.\n"
            "[PAGE 97]\nThe video exposes Tony and the judges are caught.\n"
        )
        juanito = beat(
            "Juanito",
            "Freezes paralyzed when his turn arrives; Javierín steps forward "
            "to cover for him; Juanito then presses his fist to his chest and "
            "releases a raw, desafinada note that evolves into unearthly, "
            "angelical vocal sounds that hypnotize the entire auditorium into "
            "sepulcral silence.",
            "Juanito produces a transformative vocal performance that silences "
            "the hostile crowd; audience is hypnotized; the ovation that "
            "follows is stronger than the one given to Los Chavos.",
            92,
        )
        next_beat = beat(
            "The judges",
            "The judges score the performance.",
            "The scoring begins.",
            94,
            2,
        )
        juanito_split = [
            beat(
                "Juanito",
                "Freezes paralyzed when his turn arrives.",
                "Juanito cannot sing.",
                92,
            ),
            beat(
                "Javierín",
                "Javierín steps forward to cover for Juanito.",
                "Javierín prepares to sing.",
                93,
                2,
            ),
            beat(
                "Juanito",
                "Juanito presses his fist to his chest and releases a raw note "
                "that evolves into angelical vocal sounds.",
                "Juanito hypnotizes the auditorium and earns a larger ovation "
                "than Los Chavos.",
                93,
                3,
            ),
            {**next_beat, "order": 4},
        ]
        video = beat(
            "Dante and Tony (via giant arena screen video)",
            "A hidden-camera video plays on the enormous arena screen showing "
            "Dante and Tony discussing the fabricated interview video and Tony "
            "revealing he bribed judges with watches, money, lingerie, and a "
            "Memo Ochoa poster.",
            "Video exposure causes judges to attempt escape; security detains "
            "all judges; conductor formally announces the result will be "
            "overturned and trophy awarded to Cosquillitas; public erupts in "
            "approval.",
            97,
        )
        video_split = [
            beat(
                "The arena screen",
                "A hidden-camera video plays showing Dante and Tony discussing "
                "the fabricated interview video.",
                "Dante and Tony are exposed.",
                97,
            ),
            beat(
                "The judges and security",
                "The video shows judges receiving Tony’s gifts.",
                "The judges flee and security catches them.",
                97,
                2,
            ),
            beat(
                "The conductor",
                "The conductor overturns the result.",
                "The conductor announces that the result is overturned; "
                "the trophy and prize are awarded to Cosquillitas; the "
                "public applauds and celebrates.",
                97,
                3,
            ),
        ]

        for prior, repaired in (
            ([juanito, next_beat], juanito_split),
            ([video], video_split),
        ):
            with self.subTest(actor=prior[0]["actor"]):
                preserved, diagnostics = (
                    cv._literal_retry_preserves_prior_events(
                        {"sequence_ledger": prior},
                        {"sequence_ledger": repaired},
                        source,
                    )
                )
                self.assertTrue(preserved, diagnostics)

        without_javierin = [
            row for row in juanito_split if row["actor"] != "Javierín"
        ]
        preserved, _diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [juanito, next_beat]},
            {"sequence_ledger": without_javierin},
            source,
        )
        self.assertFalse(preserved)
        without_capture = [video_split[0], video_split[2]]
        preserved, _diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [video]},
            {"sequence_ledger": without_capture},
            source,
        )
        self.assertFalse(preserved)

        deleted_freeze = copy.deepcopy(juanito_split)
        deleted_freeze[0].update({
            "action": "Juanito closes his eyes when his turn arrives.",
            "result": "Juanito remains focused.",
        })
        preserved, _diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [juanito, next_beat]},
            {"sequence_ledger": deleted_freeze},
            source,
        )
        self.assertFalse(preserved)

        deleted_ovation = copy.deepcopy(juanito_split)
        deleted_ovation[2]["result"] = (
            "Juanito's notes hypnotize the entire auditorium while Los "
            "Chavos watch."
        )
        preserved, _diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [juanito, next_beat]},
            {"sequence_ledger": deleted_ovation},
            source,
        )
        self.assertFalse(preserved)

        for result in (
            "Juanito hypnotizes the auditorium and watches Los Chavos "
            "receive a larger ovation than him.",
            "Juanito hypnotizes the auditorium; Los Chavos receive a larger "
            "ovation than Juanito.",
            "Juanito hypnotizes the auditorium and Los Chavos earn the "
            "stronger ovation.",
        ):
            with self.subTest(reversed_ovation=result):
                reversed_ovation = copy.deepcopy(juanito_split)
                reversed_ovation[2]["result"] = result
                preserved, _diagnostics = (
                    cv._literal_retry_preserves_prior_events(
                        {"sequence_ledger": [juanito, next_beat]},
                        {"sequence_ledger": reversed_ovation},
                        source,
                    )
                )
                self.assertFalse(preserved)

        reversed_capture = copy.deepcopy(video_split)
        reversed_capture[1]["result"] = (
            "Security flees and the judges catch them."
        )
        preserved, _diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [video]},
            {"sequence_ledger": reversed_capture},
            source,
        )
        self.assertFalse(preserved)

        reversed_award = copy.deepcopy(video_split)
        reversed_award[2]["result"] = (
            "The conductor announces that the result is overturned; "
            "Cosquillitas awards the trophy and prize to the conductor; "
            "the public applauds and celebrates."
        )
        preserved, _diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [video]},
            {"sequence_ledger": reversed_award},
            source,
        )
        self.assertFalse(preserved)

    def test_literal_retry_preserves_repeated_reveal_objects_and_order(self):
        def beat(action, result, order=1):
            return {
                "order": order,
                "phase": "climax",
                "actor": "Tony",
                "action": action,
                "result": result,
                "character_knowledge": "Tony knows what the screen shows.",
                "audience_knowledge": "The audience sees the screen.",
                "page": 97,
            }

        prior = beat(
            "Tony reveals the birthday video; Tony reveals the vacation "
            "video; Tony reveals the wedding video.",
            "The public applauds.",
        )
        repaired = [
            beat(
                "Tony reveals the birthday video.",
                "The birthday video appears.",
            ),
            beat(
                "Tony reveals the vacation video.",
                "The vacation video appears.",
                2,
            ),
            beat(
                "Tony reveals the wedding video.",
                "The public applauds.",
                3,
            ),
        ]
        source = (
            "[PAGE 97]\nTony reveals the birthday video.\n"
            "Tony reveals the vacation video.\n"
            "Tony reveals the wedding video.\nThe public applauds.\n"
        )

        preserved, diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [prior]},
            {"sequence_ledger": repaired},
            source,
        )
        self.assertTrue(preserved, diagnostics)

        for label, changed in (
            ("drop one", [repaired[0], repaired[2]]),
            ("drop two", [repaired[0]]),
            ("reorder", [repaired[1], repaired[0], repaired[2]]),
            (
                "expand actor",
                [
                    {
                        **repaired[0],
                        "action": (
                            "Carlos and Tony reveal the birthday video."
                        ),
                    },
                    repaired[1],
                    repaired[2],
                ],
            ),
        ):
            with self.subTest(label=label):
                preserved, _diagnostics = (
                    cv._literal_retry_preserves_prior_events(
                        {"sequence_ledger": [prior]},
                        {"sequence_ledger": changed},
                        source,
                    )
                )
                self.assertFalse(preserved)

        bribery_prior = beat(
            "Tony reveals the birthday bribery video; Tony reveals the "
            "vacation bribery video; Tony reveals the wedding bribery video.",
            "The public applauds.",
        )
        bribery_repaired = copy.deepcopy(repaired)
        for row in bribery_repaired:
            row["action"] = row["action"].replace(
                " video", " bribery video"
            )
        preserved, diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [bribery_prior]},
            {"sequence_ledger": bribery_repaired},
            source,
        )
        self.assertTrue(preserved, diagnostics)
        substituted_bribery = copy.deepcopy(bribery_repaired)
        substituted_bribery[0]["action"] = (
            "Tony reveals the vacation bribery video."
        )
        preserved, _diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [bribery_prior]},
            {"sequence_ledger": substituted_bribery},
            source,
        )
        self.assertFalse(preserved)

    def test_literal_retry_preserves_distinct_performance_locations(self):
        def beat(action, result, order=1):
            return {
                "order": order,
                "phase": "climax",
                "actor": "Juanito",
                "action": action,
                "result": result,
                "character_knowledge": "Juanito knows that he performed.",
                "audience_knowledge": "The audience hears the performance.",
                "page": 93,
            }

        prior = beat(
            "Juanito releases a raw note in the lobby; Juanito releases a "
            "vocal sound on stage.",
            "The public applauds.",
        )
        repaired = [
            beat(
                "Juanito releases a raw note in the lobby.",
                "The lobby audience listens.",
            ),
            beat(
                "Juanito releases a vocal sound on stage.",
                "The public applauds.",
                2,
            ),
        ]
        source = (
            "[PAGE 93]\nJuanito releases a raw note in the lobby.\n"
            "Juanito releases a vocal sound on stage.\nThe public applauds.\n"
        )

        preserved, diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [prior]},
            {"sequence_ledger": repaired},
            source,
        )
        self.assertTrue(preserved, diagnostics)

        dropped = copy.deepcopy(repaired[:1])
        dropped[0]["result"] = "The public applauds."
        substituted = copy.deepcopy(repaired)
        substituted[0]["action"] = (
            "Juanito releases a raw note on stage."
        )
        expanded_actor = copy.deepcopy(repaired)
        expanded_actor[0]["action"] = (
            "Carlos and Juanito release a raw note in the lobby."
        )
        for label, changed in (
            ("drop", dropped),
            ("substitute", substituted),
            ("reorder", list(reversed(repaired))),
            ("expand actor", expanded_actor),
        ):
            with self.subTest(label=label):
                preserved, _diagnostics = (
                    cv._literal_retry_preserves_prior_events(
                        {"sequence_ledger": [prior]},
                        {"sequence_ledger": changed},
                        source,
                    )
                )
                self.assertFalse(preserved)

        same_location_prior = beat(
            "Juanito releases a low note on stage; Juanito releases a high "
            "note on stage.",
            "The public applauds.",
        )
        same_location_repaired = [
            beat(
                "Juanito releases a low note on stage.",
                "The audience listens.",
            ),
            beat(
                "Juanito releases a high note on stage.",
                "The public applauds.",
                2,
            ),
        ]
        preserved, diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [same_location_prior]},
            {"sequence_ledger": same_location_repaired},
            source,
        )
        self.assertTrue(preserved, diagnostics)
        same_location_dropped = copy.deepcopy(same_location_repaired[:1])
        same_location_dropped[0]["result"] = "The public applauds."
        preserved, _diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [same_location_prior]},
            {"sequence_ledger": same_location_dropped},
            source,
        )
        self.assertFalse(preserved)

        timed_prior = beat(
            "Juanito releases a raw note on stage before lunch; Juanito "
            "produces a vocal performance on stage after lunch.",
            "The public applauds.",
        )
        timed_repaired = [
            beat(
                "Juanito releases a raw note on stage before lunch.",
                "The audience listens.",
            ),
            beat(
                "Juanito produces a vocal performance on stage after lunch.",
                "The public applauds.",
                2,
            ),
        ]
        preserved, diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [timed_prior]},
            {"sequence_ledger": timed_repaired},
            source,
        )
        self.assertTrue(preserved, diagnostics)
        timed_dropped = copy.deepcopy(timed_repaired[1:])
        preserved, _diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [timed_prior]},
            {"sequence_ledger": timed_dropped},
            source,
        )
        self.assertFalse(preserved)

    def test_literal_retry_preserves_repeated_detention_locations_and_order(self):
        def beat(action, result, order=1):
            return {
                "order": order,
                "phase": "climax",
                "actor": "Security",
                "action": action,
                "result": result,
                "character_knowledge": "Security knows the judges are held.",
                "audience_knowledge": "The public sees the detentions.",
                "page": 97,
            }

        prior = beat(
            "Security detains the judges in the lobby; security detains the "
            "judges backstage.",
            "The public applauds.",
        )
        repaired = [
            beat(
                "Security detains the judges in the lobby.",
                "The lobby is secured.",
            ),
            beat(
                "Security detains the judges backstage.",
                "The public applauds.",
                2,
            ),
        ]
        source = (
            "[PAGE 97]\nSecurity detains the judges in the lobby.\n"
            "Security detains the judges backstage.\nThe public applauds.\n"
        )

        preserved, diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [prior]},
            {"sequence_ledger": repaired},
            source,
        )
        self.assertTrue(preserved, diagnostics)

        dropped = copy.deepcopy(repaired[:1])
        dropped[0]["result"] = "The public applauds."
        substituted = copy.deepcopy(repaired)
        substituted[0]["action"] = (
            "Security detains the judges backstage."
        )
        for label, changed in (
            ("drop", dropped),
            ("substitute", substituted),
            ("reorder", list(reversed(repaired))),
        ):
            with self.subTest(label=label):
                preserved, _diagnostics = (
                    cv._literal_retry_preserves_prior_events(
                        {"sequence_ledger": [prior]},
                        {"sequence_ledger": changed},
                        source,
                    )
                )
                self.assertFalse(preserved)

        multiword_prior = beat(
            "Security detains the judges in the red corridor.",
            "The public applauds.",
        )
        multiword_repaired = [beat(
            "Security detains the judges in the red corridor.",
            "The public applauds.",
        )]
        preserved, diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [multiword_prior]},
            {"sequence_ledger": multiword_repaired},
            source,
        )
        self.assertTrue(preserved, diagnostics)
        multiword_repaired[0]["action"] = (
            "Security detains the judges in the red balcony."
        )
        preserved, _diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [multiword_prior]},
            {"sequence_ledger": multiword_repaired},
            source,
        )
        self.assertFalse(preserved)

    def test_literal_retry_keeps_distinct_same_field_transfix_events(self):
        def beat(action, result, order=1):
            return {
                "order": order,
                "phase": "climax",
                "actor": "Juanito",
                "action": action,
                "result": result,
                "character_knowledge": "Juanito knows what he did.",
                "audience_knowledge": "The audience experiences it.",
                "page": 93,
            }

        prior = beat(
            "Juanito hypnotizes the front audience on stage; Juanito "
            "silences the rear audience on stage.",
            "The public applauds.",
        )
        repaired = [
            beat(
                "Juanito hypnotizes the front audience on stage.",
                "The front audience falls silent.",
            ),
            beat(
                "Juanito silences the rear audience on stage.",
                "The public applauds.",
                2,
            ),
        ]
        source = (
            "[PAGE 93]\nJuanito hypnotizes the front audience on stage.\n"
            "Juanito silences the rear audience on stage.\n"
        )

        preserved, diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [prior]},
            {"sequence_ledger": repaired},
            source,
        )
        self.assertTrue(preserved, diagnostics)
        preserved, _diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [prior]},
            {"sequence_ledger": repaired[:1]},
            source,
        )
        self.assertFalse(preserved)

        passive_prior = beat(
            "Juanito hypnotizes the front audience on stage; the rear "
            "audience is hypnotized on stage.",
            "The public applauds.",
        )
        passive_repaired = copy.deepcopy(repaired[:1])
        passive_repaired[0]["result"] = "The public applauds."
        preserved, _diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [passive_prior]},
            {"sequence_ledger": passive_repaired},
            source,
        )
        self.assertFalse(preserved)

    def test_literal_retry_binds_counts_and_noncompletion(self):
        def beat(action, order=1):
            return {
                "order": order,
                "phase": "climax",
                "actor": "Tony and Security",
                "action": action,
                "result": "The beat continues.",
                "character_knowledge": "Tony and Security know what happens.",
                "audience_knowledge": "The public sees what happens.",
                "page": 97,
            }

        prior = beat(
            "Tony bribes two masked judges; Security tries to detain the "
            "judges; "
            "Tony reveals the birthday video."
        )
        repaired = [
            beat("Tony bribes 2 masked judges."),
            beat("Security tries to detain the judges.", 2),
            beat("Tony reveals the birthday video.", 3),
        ]
        source = (
            "[PAGE 97]\nTony bribes two masked judges.\n"
            "Tony bribes two senior judges.\n"
            "Security tries to detain the judges.\n"
            "Security intends to detain the judges.\n"
            "Security detains the judges.\n"
            "Tony reveals the birthday video.\n"
        )

        preserved, diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [prior]},
            {"sequence_ledger": repaired},
            source,
        )
        self.assertTrue(preserved, diagnostics)

        for label, index, action in (
            (
                "word-number mutation",
                0,
                "Tony bribes three masked judges.",
            ),
            (
                "counted-subgroup mutation",
                0,
                "Tony bribes two senior judges.",
            ),
            ("completion mutation", 1, "Security detains the judges."),
        ):
            with self.subTest(label=label):
                changed = copy.deepcopy(repaired)
                changed[index]["action"] = action
                preserved, _diagnostics = (
                    cv._literal_retry_preserves_prior_events(
                        {"sequence_ledger": [prior]},
                        {"sequence_ledger": changed},
                        source,
                    )
                )
                self.assertFalse(preserved)

        completed_prior = copy.deepcopy(prior)
        completed_prior["action"] = completed_prior["action"].replace(
            "tries to detain", "detains"
        )
        attempted_repair = copy.deepcopy(repaired)
        attempted_repair[1]["action"] = (
            "Security tries to detain the judges."
        )
        preserved, _diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [completed_prior]},
            {"sequence_ledger": attempted_repair},
            source,
        )
        self.assertFalse(preserved)

        intended_prior = copy.deepcopy(prior)
        intended_prior["action"] = intended_prior["action"].replace(
            "tries to detain", "intends to detain"
        )
        completed_repair = copy.deepcopy(repaired)
        completed_repair[1]["action"] = "Security detains the judges."
        preserved, _diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [intended_prior]},
            {"sequence_ledger": completed_repair},
            source,
        )
        self.assertFalse(preserved)

        intended_repair = copy.deepcopy(repaired)
        intended_repair[1]["action"] = (
            "Security intends to detain the judges."
        )
        preserved, _diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [completed_prior]},
            {"sequence_ledger": intended_repair},
            source,
        )
        self.assertFalse(preserved)

    def test_literal_retry_preserves_repeated_fabricated_objects_and_order(self):
        def beat(action, result, order=1):
            return {
                "order": order,
                "phase": "climax",
                "actor": "Tony",
                "action": action,
                "result": result,
                "character_knowledge": "Tony knows what he fabricated.",
                "audience_knowledge": "The audience sees the fabrications.",
                "page": 97,
            }

        prior = beat(
            "Tony fabricates the birthday video; Tony fabricates the "
            "vacation video; Tony fabricates the wedding video.",
            "The public applauds.",
        )
        repaired = [
            beat(
                "Tony fabricates the birthday video.",
                "The birthday video appears.",
            ),
            beat(
                "Tony fabricates the vacation video.",
                "The vacation video appears.",
                2,
            ),
            beat(
                "Tony fabricates the wedding video.",
                "The public applauds.",
                3,
            ),
        ]
        source = (
            "[PAGE 97]\nTony fabricates the birthday video.\n"
            "Tony fabricates the vacation video.\n"
            "Tony fabricates the wedding video.\nThe public applauds.\n"
        )

        preserved, diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [prior]},
            {"sequence_ledger": repaired},
            source,
        )
        self.assertTrue(preserved, diagnostics)

        substituted = copy.deepcopy(repaired)
        substituted[0]["action"] = "Tony fabricates the vacation video."
        for label, changed in (
            ("drop", [repaired[0], repaired[2]]),
            ("substitute", substituted),
            ("reorder", [repaired[1], repaired[0], repaired[2]]),
        ):
            with self.subTest(label=label):
                preserved, _diagnostics = (
                    cv._literal_retry_preserves_prior_events(
                        {"sequence_ledger": [prior]},
                        {"sequence_ledger": changed},
                        source,
                    )
                )
                self.assertFalse(preserved)

    def test_literal_retry_preserves_generic_award_object(self):
        def beat(action, result, order=1):
            return {
                "order": order,
                "phase": "climax",
                "actor": "The conductor",
                "action": action,
                "result": result,
                "character_knowledge": "The conductor knows the result.",
                "audience_knowledge": "The audience sees the result.",
                "page": 97,
            }

        prior = beat(
            "The scholarship is awarded to Juanito; security detains the "
            "judges; the conductor overturns the result.",
            "The public applauds.",
        )
        repaired = [
            beat(
                "The scholarship is awarded to Juanito.",
                "Juanito receives the scholarship.",
            ),
            beat(
                "Security detains the judges.",
                "The judges are held.",
                2,
            ),
            beat(
                "The conductor overturns the result.",
                "The public applauds.",
                3,
            ),
        ]
        source = (
            "[PAGE 97]\nThe scholarship is awarded to Juanito.\n"
            "The car is awarded to Juanito.\nSecurity detains the judges.\n"
            "The conductor overturns the result.\nThe public applauds.\n"
        )

        preserved, diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [prior]},
            {"sequence_ledger": repaired},
            source,
        )
        self.assertTrue(preserved, diagnostics)
        substituted = copy.deepcopy(repaired)
        substituted[0]["action"] = "The car is awarded to Juanito."
        substituted[0]["result"] = "Juanito receives the car."
        preserved, _diagnostics = cv._literal_retry_preserves_prior_events(
            {"sequence_ledger": [prior]},
            {"sequence_ledger": substituted},
            source,
        )
        self.assertFalse(preserved)

    def test_literal_retry_cannot_erase_staged_tag_knowledge(self):
        source_text = "[PAGE 1]\nCarlos learns that Ana survived.\n"
        sequence = provider_audit_core(valid_coverage())["sequence_ledger"]
        for beats in sequence.values():
            for beat in beats:
                beat["page"] = 1
        sequence["tag"][0].update({
            "actor": "Carlos",
            "action": "Carlos learns that Ana survived.",
            "result": "Carlos learns that Ana survived.",
            "character_knowledge": cv.SEQUENCE_KNOWLEDGE_NOT_APPLICABLE,
            "audience_knowledge": "Carlos learns that Ana survived.",
        })

        merged = cv._merge_literal_sequence_retry(
            {"verdicts": []},
            {"sequence_ledger": sequence},
            [1],
            source_text,
        )

        tag = next(
            beat for beat in merged["sequence_ledger"]
            if beat["phase"] == "tag"
        )
        self.assertNotIn(
            tag["order"],
            merged.get(
                "_sequence_repair_authorized_not_applicable_orders", []
            ),
        )
        row = next(
            item for item in cv.build_detail_audit_rows(
                {}, [], merged["sequence_ledger"]
            )
            if item["identifier"] == f"sequence_ledger[{tag['order']}]"
        )
        candidate = {
            "classification": "supported",
            "note": "The source supports every field.",
            "checks": [
                {
                    "field": field,
                    "source_id": f"{row['slot']}:{field}:p001-l001",
                    "supports": True,
                }
                for field in row["subject"]["required_fields"]
            ],
        }
        decoded, reason = cv._decode_grounded_detail_value(
            candidate, row, source_text
        )
        self.assertIsNone(decoded)
        self.assertIn("contradicts staged actor knowledge", reason)

    def test_knowledge_parser_handles_awareness_and_seeking_literally(self):
        self.assertTrue(cv._has_exactly_one_knowledge_claim(
            "Cosquillitas are terrified and aware that the public hates them"
        ))
        self.assertTrue(cv._has_exactly_one_knowledge_claim(
            "Anita learns that her father returned and is seeking reconciliation"
        ))
        self.assertTrue(cv._has_exactly_one_knowledge_claim(
            "Lucesita se da cuenta que Richie no le cree del todo."
        ))
        self.assertTrue(cv._has_exactly_one_knowledge_claim(
            "Carlos knows that Anita realizes the fraud."
        ))
        self.assertTrue(cv._has_exactly_one_knowledge_claim(
            "Carlos knows that Anita, after the delay, realizes the fraud."
        ))
        self.assertFalse(cv._has_exactly_one_knowledge_claim(
            "Lucesita se da cuenta del engaño y Richie cree que ganó."
        ))
        self.assertFalse(cv._has_exactly_one_knowledge_claim(
            "Lucesita sabe que el plan falla y Tony se da cuenta del engaño."
        ))
        self.assertFalse(cv._has_exactly_one_knowledge_claim(
            "Carlos knows that the plan failed and Anita was aware of the fraud."
        ))
        self.assertFalse(cv._has_exactly_one_knowledge_claim(
            "Lucesita sabe que el plan falla, Tony se da cuenta del engaño."
        ))
        self.assertFalse(cv._has_exactly_one_knowledge_claim(
            "Carlos knows that the plan failed, Anita was aware of the fraud."
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

    def test_sequence_adjacency_cannot_cross_a_scene_heading(self):
        actor = {"source_anchor_id": "p001-l001"}
        action = {"source_anchor_id": "p001-l003"}
        page = "Diego leaves.\nINT. OTHER HOUSE - DAY\nCarlos shoots Ana."

        self.assertIsNone(
            cv._sequence_anchor_line_distance(actor, action, page)
        )
        self.assertEqual(
            cv._sequence_anchor_line_distance(
                actor, action, "Diego leaves.\nHe stops.\nDiego returns."
            ),
            2,
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

        report, _usage = run_engine(
            new_store(), transport, max_calls=3
        )

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
            ({
                "sequence_ledger": provider_audit_core(fixed)[
                    "sequence_ledger"
                ],
            }, settled_usage()),
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

    def test_detail_17_range_migration_reuses_only_exact_unchanged_rows(self):
        class FailAuditSave(cv.LocalCheckpointStore):
            def save(self, key, stage, record):
                if stage == "audit":
                    raise RuntimeError("stop before final audit checkpoint")
                super().save(key, stage, record)

        def prepare(rows_hash_mutator=None):
            coverage = valid_coverage()
            audit = provider_audit_core(coverage)
            normalized = cv.normalize_audit_tool_input(
                copy.deepcopy(audit), range(1, 7)
            )
            fixture_rows = cv.build_detail_audit_rows(
                coverage,
                cv.build_existing_evidence_checks(
                    coverage, SCREENPLAY_TEXT
                ),
                normalized["sequence_ledger"],
            )
            store = FailAuditSave(Path(tempfile.mkdtemp()) / "cv1")
            observed_rows = []
            original_builder = cv.build_detail_audit_rows

            def recording_builder(*args, **kwargs):
                rows = original_builder(*args, **kwargs)
                observed_rows.append(copy.deepcopy(rows))
                return rows

            with self.assertRaisesRegex(
                RuntimeError, "stop before final audit checkpoint"
            ), patch.object(
                cv,
                "build_detail_audit_rows",
                side_effect=recording_builder,
            ):
                run_engine(store, FakeTransport([
                    (coverage, settled_usage()),
                    (audit, settled_usage()),
                    (
                        typed_detail_payload_for_rows(fixture_rows),
                        settled_usage(),
                    ),
                ]), max_calls=4)
            progress_path = next(
                store.root.glob("*/audit_details_progress.json")
            )
            record = json.loads(progress_path.read_text(encoding="utf-8"))
            current_rows = next(
                rows for rows in observed_rows
                if cv.canonical_json_hash(rows)
                == record["payload"]["rows_sha256"]
            )
            prior_rows = copy.deepcopy(current_rows)
            for row in prior_rows:
                subject = row.get("subject")
                if row.get("kind") == "sequence_evidence" and isinstance(
                    subject, dict
                ):
                    subject.pop("source_page_range", None)
                    subject.pop("material_claim_atoms", None)
                    subject.pop("required_material_atom_reaudit", None)
                    beat = subject.get("beat")
                    if (
                        isinstance(beat, dict)
                        and str(beat.get("character_knowledge", "")).strip()
                        .upper() == "NOT LOCATED"
                    ):
                        subject["required_fields"] = [
                            field for field in subject["required_fields"]
                            if field != "character_knowledge"
                        ]
            rows_sha256 = cv.canonical_json_hash(prior_rows)
            if rows_hash_mutator is not None:
                rows_sha256 = rows_hash_mutator(rows_sha256)
            record["payload"].update({
                "detail_contract_version": (
                    cv.SEQUENCE_RANGE_MIGRATION_VERSION
                ),
                "rows_sha256": rows_sha256,
            })
            progress_path.write_text(
                json.dumps(cv._sealed_record(
                    record["binding"], record["payload"]
                )),
                encoding="utf-8",
            )
            return cv.LocalCheckpointStore(store.root), progress_path, current_rows

        store, progress_path, current_rows = prepare()
        resume = FakeTransport([RuntimeError("stop after exact migration")])
        with self.assertRaisesRegex(RuntimeError, "stop after exact migration"):
            run_engine(store, resume, max_calls=4)

        self.assertEqual(len(resume.calls), 1)
        self.assertEqual(
            resume.calls[0]["stage"],
            "coverage_v1.fact_audit_details_typed_b",
        )
        schema = resume.calls[0]["tool"]["input_schema"]["properties"]
        migrated_slots = [
            slot
            for group in ("sequence_results", "sequence_knowledge_results")
            for slot in schema.get(group, {}).get("items", {}).get(
                "properties", {}
            ).get("slot", {}).get("enum", [])
        ]
        self.assertEqual(
            set(migrated_slots),
            {
                str(row["slot"]) for row in current_rows
                if row["kind"] == "sequence_evidence"
            },
        )
        migrated = json.loads(progress_path.read_text(encoding="utf-8"))[
            "payload"
        ]
        self.assertEqual(
            migrated["detail_contract_version"],
            cv.DETAIL_AUDIT_CONTRACT_VERSION,
        )
        self.assertEqual(
            migrated["rows_sha256"], cv.canonical_json_hash(current_rows)
        )

        drift_store, _drift_progress, drift_rows = prepare(
            lambda _value: "f" * 64
        )
        receipts_path = next(drift_store.root.glob("*/call_receipts.json"))
        receipts_record = json.loads(
            receipts_path.read_text(encoding="utf-8")
        )
        receipts_record["payload"]["receipts"] = {}
        receipts_path.write_text(
            json.dumps(cv._sealed_record(
                receipts_record["binding"], receipts_record["payload"]
            )),
            encoding="utf-8",
        )
        drift = FakeTransport([RuntimeError("stop after rejected drift")])
        with self.assertRaisesRegex(RuntimeError, "stop after rejected drift"):
            run_engine(drift_store, drift, max_calls=4)
        self.assertEqual(len(drift.calls), 1)
        self.assertEqual(
            drift.calls[0]["stage"], "coverage_v1.fact_audit_details"
        )
        drift_schema = drift.calls[0]["tool"]["input_schema"]["properties"]
        requested_slots = {
            slot
            for group in drift_schema.values()
            for slot in group.get("items", {}).get("properties", {}).get(
                "slot", {}
            ).get("enum", [])
        }
        self.assertEqual(
            requested_slots, {str(row["slot"]) for row in drift_rows}
        )

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

    def test_exhausted_replay_reconciles_evidence_without_spend(self):
        coverage = valid_coverage()
        coverage["development_priorities"][0] = {
            "priority": "Plant and assign the surveillance video",
            "why": "No camera source exists before the reveal",
            "how": "Show Richie filming it",
        }
        coverage["development_priorities"][1] = {
            "priority": "Thin and sequence the final resolution cascade",
            "why": "The comic pile-on overwhelms the emotional landing",
            "how": "Let the romance breathe, then accelerate the parody",
        }
        source = SCREENPLAY_TEXT.replace(
            "[PAGE 3]", "[PAGE 3]\nA hidden camera records the bribe."
        ).replace(
            "[PAGE 4]",
            "[PAGE 4]\nRichie films the bribe with the hidden camera.\n"
            "The surveillance video plays on screen.",
        )
        core = provider_audit_core(coverage)
        normalized = cv.normalize_audit_tool_input(
            copy.deepcopy(core), range(1, 7)
        )
        rows = cv.build_detail_audit_rows(
            coverage,
            cv.build_existing_evidence_checks(coverage, source),
            normalized["sequence_ledger"],
        )
        focused = next(
            row for row in rows
            if row["identifier"] == "development_priorities[0]"
        )
        store = new_store()
        run_engine(
            store,
            FakeTransport([
                (coverage, settled_usage()),
                (core, settled_usage()),
                (
                    supported_detail_payload(coverage, normalized, source),
                    settled_usage(),
                ),
                (
                    typed_detail_payload_for_rows([focused], source),
                    settled_usage(),
                ),
            ]),
            text=source,
            max_calls=4,
        )

        [audit_path] = list(store.root.glob("*/audit.json"))
        audit_record = json.loads(audit_path.read_text(encoding="utf-8"))
        evidence = {
            row["field_path"]: row
            for row in audit_record["payload"]["existing_evidence_verdicts"]
        }
        evidence["development_priorities[0]"].update({
            "classification": "partially_supported",
            "note": "The source is established, but activation is unclear.",
            "source_status": "established",
            "activation_status": "unconfirmed",
        })
        evidence["development_priorities[1]"].update({
            "classification": "unsupported",
            "note": "This is editorial advice, not a factual claim.",
        })
        evidence["development_priorities[1]"].pop(
            "factual_applicability", None
        )
        stale_guard = next(
            row for row in audit_record["payload"]["verdicts"]
            if row["claim_id"] == "guard.existing_evidence"
        )
        stale_guard.update({
            "classification": "supported",
            "note": "Stale checkpoint aggregate.",
        })
        audit_path.write_text(
            json.dumps(cv._sealed_record(
                audit_record["binding"], audit_record["payload"]
            )),
            encoding="utf-8",
        )
        [budget_path] = list(store.root.glob("*/budget.json"))
        [receipts_path] = list(store.root.glob("*/call_receipts.json"))
        budget_before = budget_path.read_bytes()
        receipts_before = receipts_path.read_bytes()

        replay = FakeTransport([])
        report, usage = run_engine(
            store, replay, text=source, max_calls=4
        )

        self.assertEqual(replay.calls, [])
        self.assertEqual(usage["call_count"], 0)
        self.assertEqual(budget_path.read_bytes(), budget_before)
        self.assertEqual(receipts_path.read_bytes(), receipts_before)
        replayed_evidence = {
            row["field_path"]: row
            for row in report["fact_audit"]["existing_evidence_verdicts"]
        }
        self.assertEqual(
            replayed_evidence["development_priorities[0]"]["classification"],
            "unsupported",
        )
        self.assertEqual(
            replayed_evidence["development_priorities[1]"][
                "factual_applicability"
            ],
            "not_applicable",
        )
        replayed_guard = next(
            row for row in report["fact_audit"]["verdicts"]
            if row["claim_id"] == "guard.existing_evidence"
        )
        self.assertEqual(replayed_guard["classification"], "unsupported")

    def test_engine_only_taste_parts_preserve_settled_detail_receipt(self):
        class FailProgressAfterDetail(cv.LocalCheckpointStore):
            fail_progress = False

            def save(self, key, stage, record):
                if stage == "audit_details_progress" and self.fail_progress:
                    self.fail_progress = False
                    raise RuntimeError("crash after settled detail receipt")
                super().save(key, stage, record)

        coverage = valid_coverage()
        store = FailProgressAfterDetail(
            Path(tempfile.mkdtemp()) / "cv1"
        )
        current_builder = cv.build_existing_evidence_checks

        def old_shape_checks(*args, **kwargs):
            checks = current_builder(*args, **kwargs)
            for check in checks:
                check.pop("_recommendation_parts", None)
            return checks

        current_checks = current_builder(coverage, SCREENPLAY_TEXT)
        old_checks = old_shape_checks(coverage, SCREENPLAY_TEXT)
        audit = provider_audit_core(coverage)
        normalized = cv.normalize_audit_tool_input(
            copy.deepcopy(audit), range(1, 7)
        )
        page_map = cv.build_page_reference_map(
            SCREENPLAY_TEXT, 6, None
        )
        audit_args = (
            SCREENPLAY_TEXT,
            "El Último Portero",
            cv.build_audit_claims(coverage),
        )
        self.assertEqual(
            cv.canonical_json_hash(cv.build_audit_user_blocks(
                *audit_args,
                coverage=coverage,
                page_reference_map=page_map,
                evidence_checks=current_checks,
                sequence_focus=cv.build_sequence_focus(SCREENPLAY_TEXT),
            )),
            cv.canonical_json_hash(cv.build_audit_user_blocks(
                *audit_args,
                coverage=coverage,
                page_reference_map=page_map,
                evidence_checks=old_checks,
                sequence_focus=cv.build_sequence_focus(SCREENPLAY_TEXT),
            )),
        )
        self.assertEqual(
            cv.canonical_json_hash(cv.build_detail_audit_rows(
                coverage, current_checks, normalized["sequence_ledger"]
            )),
            cv.canonical_json_hash(cv.build_detail_audit_rows(
                coverage, old_checks, normalized["sequence_ledger"]
            )),
        )

        class ArmCrashTransport(FakeTransport):
            def __call__(self, **kwargs):
                result = super().__call__(**kwargs)
                if kwargs.get("stage") == "coverage_v1.fact_audit_details":
                    store.fail_progress = True
                return result

        first = ArmCrashTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (supported_detail_payload(coverage), settled_usage()),
        ])
        with patch.object(
            cv,
            "build_existing_evidence_checks",
            side_effect=old_shape_checks,
        ):
            with self.assertRaisesRegex(
                RuntimeError, "crash after settled detail receipt"
            ):
                run_engine(store, first, max_calls=3)

        budget_path = next(store.root.glob("*/budget.json"))
        receipts_path = next(store.root.glob("*/call_receipts.json"))
        budget_before = budget_path.read_bytes()
        receipts_before = receipts_path.read_bytes()

        resume = FakeTransport([])
        usage = {}
        with patch.object(
            cv._CostGuard,
            "clear_receipts",
            side_effect=RuntimeError("stop before receipt cleanup"),
        ):
            with self.assertRaisesRegex(
                RuntimeError, "stop before receipt cleanup"
            ):
                run_engine(
                    store,
                    resume,
                    max_calls=3,
                    usage_sink=usage,
                )
        self.assertEqual(resume.calls, [])
        self.assertEqual(usage["call_count"], 0)
        self.assertEqual(budget_path.read_bytes(), budget_before)
        self.assertEqual(receipts_path.read_bytes(), receipts_before)
        self.assertTrue(list(store.root.glob("*/audit.json")))

        finish = FakeTransport([])
        report, finish_usage = run_engine(store, finish, max_calls=3)
        self.assertEqual(finish.calls, [])
        self.assertEqual(finish_usage["call_count"], 0)
        self.assertEqual(report["status"], "sealed")

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
        payload["results"][row["slot"]] = {
            **copy.deepcopy(focused_result),
            "note": "The existing camera source is inferable.",
        }
        for unsafe_claim in (
            "Add a brand-new camera before the reveal.",
            "Introduce an additional recording device before the reveal.",
            "Plant another camera before the reveal.",
            "Plant and play the video-exposure mechanism in Act 2.",
            (
                "Plant and assign the surveillance video evidence earlier "
                "by showing a character filming it."
            ),
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
            "Confirm Richie filmed the existing video with the established camera.",
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
            "The judges know their scores.\n"
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
            "character_knowledge": "The judges know their scores.",
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
            "character_knowledge": "The judges know their scores",
            "audience_knowledge": "El publico ve las notas 10, 10, 5 y 2",
        }
        pages = {
            "actor": 94,
            "action": 95,
            "result": 95,
            "character_knowledge": 94,
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
            "observed_knowers": ["The judges"],
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
                "material_atom_results": [
                    f"{atom['atom_id']}|not_located|"
                    f"{cv.SEQUENCE_SOURCE_NOT_LOCATED}"
                    for atom in target["subject"]["material_claim_atoms"]
                ],
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
            [
                "action", "result", "character_knowledge",
                "audience_knowledge",
            ],
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
            new_store(), transport, text=source, max_calls=3
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

    def test_completed_typed_b_plan_does_not_mask_unclassified_sibling(self):
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

        first_report, _usage = run_engine(
            store,
            FakeTransport([
                (coverage, settled_usage()),
                (audit, settled_usage()),
                (malformed_main, settled_usage()),
                (partial_final, settled_usage()),
            ]),
            max_calls=4,
        )

        self.assertEqual(first_report["status"], "needs_review")
        progress_path = next(
            store.root.glob("*/audit_details_progress.json")
        )
        progress = json.loads(progress_path.read_text(encoding="utf-8"))[
            "payload"
        ]
        self.assertEqual(
            progress["typed_b_plan"], [citation_rows[0]["slot"]]
        )

        resume = FakeTransport([(
            typed_detail_payload_for_rows([citation_rows[1]]),
            settled_usage(),
        )])
        report, usage = run_engine(store, resume, max_calls=5)

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

    def test_partial_typed_b_resume_at_call_cap_preserves_valid_rows(self):
        class FailAuditSaveOnce(cv.LocalCheckpointStore):
            fail_audit_save = False

            def save(self, key, stage, record):
                if stage == "audit" and self.fail_audit_save:
                    self.fail_audit_save = False
                    raise RuntimeError("crash before final audit checkpoint")
                super().save(key, stage, record)

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
        store = FailAuditSaveOnce(Path(tempfile.mkdtemp()) / "cv1")

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

        retry = FakeTransport([(
            typed_detail_payload_for_rows([citation_rows[1]]),
            settled_usage(),
        )])
        store.fail_audit_save = True
        with self.assertRaisesRegex(
            RuntimeError, "crash before final audit checkpoint"
        ):
            run_engine(store, retry, max_calls=6)

        self.assertEqual(len(retry.calls), 1)
        self.assertTrue(retry.calls[0]["stage"].endswith("_typed_b"))
        progress = json.loads(
            progress_path.read_text(encoding="utf-8")
        )["payload"]
        self.assertEqual(
            progress["fact_repair_deferred_at_call_cap"], 6
        )

        same_cap = FakeTransport([])
        same_cap_report, same_cap_usage = run_engine(
            store, same_cap, max_calls=6
        )
        self.assertEqual(same_cap.calls, [])
        self.assertEqual(same_cap_usage["call_count"], 0)
        retried_citation = next(
            row
            for row in same_cap_report["fact_audit"]["citation_relevance"]
            if row["owner"] == citation_rows[1]["identifier"]
        )
        self.assertNotEqual(
            retried_citation["classification"], "unclassified"
        )
        self.assertFalse(
            same_cap_report["diagnostics"]["fact_repair"]["attempted"]
        )

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
            "ce4c7b0fb3a9292976e27355ff2fa2f1b13508d4cce19a1efafa1c3313af73d6",
        )
        self.assertEqual(
            cv.canonical_json_hash(cv._legacy_detail_15_user_blocks(current)),
            "facb249ba6e3960e757ed3af3804d2025f0233283f30d5507e2ec76487fca001",
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
                item_properties.pop("material_atom_results", None)
                item_properties.pop("required_source_results", None)
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

        report, usage = run_engine(
            new_store(), transport, max_calls=4
        )
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

    def test_cosquillitas_same_page_trophy_cannot_precede_expose_source(self):
        source = SCREENPLAY_TEXT + """
Dante plays the bribery video.
The audience sees Dante play the bribery video.
Dante knows the bribery video is public.
The judges award the trophy to Cosquillitas.
The audience sees the judges award the trophy to Cosquillitas.
The judges know Cosquillitas won the trophy.
"""
        coverage = valid_coverage()
        audit = supported_audit(coverage)
        audit["sequence_ledger"][0].update({
            "actor": "The judges",
            "action": "The judges award the trophy to Cosquillitas.",
            "result": "The judges award the trophy to Cosquillitas.",
            "character_knowledge": (
                "The judges know Cosquillitas won the trophy."
            ),
            "audience_knowledge": (
                "The audience sees the judges award the trophy to "
                "Cosquillitas."
            ),
        })
        audit["sequence_ledger"][1].update({
            "actor": "Dante",
            "action": "Dante plays the bribery video.",
            "result": "Dante plays the bribery video.",
            "character_knowledge": (
                "Dante knows the bribery video is public."
            ),
            "audience_knowledge": (
                "The audience sees Dante play the bribery video."
            ),
        })
        audit = completed_audit_fixture(coverage, audit, source)
        for verdict in audit["verdicts"]:
            if verdict["claim_id"] == "guard.sequence_integrity":
                verdict["classification"] = "supported"
        count_row = {
            "field_path": "sequence_ledger[2].action#numbered_role_count",
            "classification": "supported",
        }
        audit = cv._replace_audit_details(
            audit,
            [
                *audit["existing_evidence_verdicts"],
                *audit["sequence_evidence"],
                count_row,
            ],
            audit["citation_relevance"],
        )
        guard = next(
            verdict
            for verdict in audit["verdicts"]
            if verdict["claim_id"] == "guard.sequence_integrity"
        )

        self.assertFalse(cv._sequence_repair_source_order_is_literal(audit))
        self.assertEqual(guard["classification"], "contradicted")
        self.assertIn("literal_source_order", guard["note"])

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

    def test_only_local_evidence_repair_can_run_beside_sequence_blockers(self):
        self.assertTrue(cv._fact_repair_can_run_with_sequence_pending([
            "guard.existing_evidence",
            "guard.citation_relevance",
        ]))
        self.assertFalse(cv._fact_repair_can_run_with_sequence_pending([
            "guard.cross_field_consistency",
        ]))
        original = valid_coverage()
        corrected = copy.deepcopy(original)
        corrected["pass_reason"] = (
            "The source is inferable, but activation remains unconfirmed."
        )
        self.assertEqual(
            cv._fact_repair_sequence_protected_changes(original, corrected),
            [],
        )
        corrected["story_spine"]["climax"] = "A reordered climax."
        self.assertIn(
            "fact repair changed unresolved sequence field story_spine",
            cv._fact_repair_sequence_protected_changes(original, corrected),
        )

    def test_negated_richie_camera_note_does_not_request_a_new_source(self):
        self.assertFalse(cv._asserts_new_or_missing_source(
            "These concerns support CONSIDER without turning an existing "
            "setup into a demand for a new camera."
        ))
        self.assertFalse(cv._asserts_new_or_missing_source(
            "Do not add a new camera; reuse Richie's established setup."
        ))
        self.assertTrue(cv._asserts_new_or_missing_source(
            "The rewrite requires a new camera."
        ))
        self.assertTrue(cv._asserts_new_or_missing_source(
            "Do not add a new camera, but create another source."
        ))
        self.assertTrue(cv._is_reveal_provenance_claim(
            "The surveillance video has no owner."
        ))
        self.assertTrue(cv._asserts_new_or_missing_source(
            "The surveillance video has no identified agent."
        ))

    def test_cosquillitas_richie_evidence_repair_ignores_unrelated_sequence_gaps(self):
        coverage = valid_coverage()
        coverage["development_priorities"][0] = {
            "priority": (
                "Plant and assign the surveillance video that exonerates "
                "Cosquillitas at the climax"
            ),
            "why": (
                "The video appears with no identified agent even though an "
                "existing camera is visible earlier."
            ),
            "how": (
                "Show Richie filming Tony's bribery, then submitting the footage."
            ),
        }
        source = """\
[PAGE 73]
Vemos una pequeña cámara oculta.
[PAGE 87]
Tony entrega billetes. Richie escucha todo.
[PAGE 97]
Aparece un video en la gran pantalla.
[PAGE 98]
Siguen videos donde Richie espía a Lucesita.
"""
        checks = cv.build_existing_evidence_checks(
            coverage, source
        )
        target = next(
            row for row in checks
            if row["field_path"] == "development_priorities[0]"
        )
        self.assertEqual(
            [row["printed_page"] for row in CALL12_FIXTURE["richie_evidence"]],
            [73, 87, 97, 98],
        )
        self.assertEqual(cv._focused_role_tokens(target), [
            "source_device=p.73",
            "motive_access=p.87",
            "reveal=p.97",
            "provenance_aftermath=p.98",
        ])
        audit = cv._replace_audit_details(
            supported_audit(coverage), [{
            "field_path": target["field_path"],
            "classification": "partially_supported",
            "note": (
                "The source is established, but activation remains unconfirmed."
            ),
            "reviewed_roles": cv._focused_role_tokens(target),
            "source_status": "established",
            "activation_status": "unconfirmed",
        }], [], checks)
        normalized = audit["existing_evidence_verdicts"][0]
        self.assertEqual(normalized["classification"], "unsupported")
        self.assertIn("FOCUSED_EVIDENCE_CONTRADICTION", normalized["note"])
        self.assertEqual(normalized["source_status"], "established")
        self.assertEqual(normalized["activation_status"], "unconfirmed")
        self.assertEqual(
            normalized["reviewed_roles"], cv._focused_role_tokens(target)
        )
        audit["sequence_evidence"] = [{
            "field_path": "sequence_ledger[9]",
            "classification": "unclassified",
            "note": "The auditor did not return a verdict for this claim.",
            "grounding_status": "unresolved",
            "grounding_valid": False,
        }]
        by_claim = {
            row["claim_id"]: row for row in audit["verdicts"]
        }

        targets = cv._fact_repair_targets(by_claim, audit, checks)

        self.assertIn("guard.existing_evidence", targets)

    def test_cosquillitas_richie_beat_cannot_move_after_the_expose(self):
        coverage = valid_coverage()
        coverage["story_spine"]["climax"] = (
            "Diego plays the exposé, then Cosquillitas receive the trophy."
        )
        coverage["story_spine"]["ending"] = (
            "Richie reunites with Lucesita and receives her wig."
        )
        audit = supported_audit(coverage)
        climax_template = audit["sequence_ledger"][0]
        richie = copy.deepcopy(climax_template)
        ground_sequence_row_for_test(
            richie,
            page=4,
            actor="Richie",
            action=(
                "Richie approaches Lucesita and declares his love before "
                "the exposé, then receives her wig."
            ),
            knowledge="Richie knows he still loves Lucesita.",
            audience="The audience sees Richie reunite with Lucesita.",
        )
        expose = copy.deepcopy(climax_template)
        ground_sequence_row_for_test(
            expose,
            page=5,
            actor="Diego",
            action="Diego plays the exposé and overturns the corrupt result.",
            knowledge="Diego knows the corrupt result is overturned.",
            audience="The audience sees Diego play the exposé.",
        )
        trophy = copy.deepcopy(climax_template)
        ground_sequence_row_for_test(
            trophy,
            page=6,
            actor="The conductor",
            action="The conductor awards Cosquillitas the trophy.",
            knowledge="The conductor knows Cosquillitas won.",
            audience="The audience sees Cosquillitas receive the trophy.",
        )
        for order, row in enumerate((richie, expose, trophy), start=1):
            row["order"] = order
            row["phase"] = "climax"
        audit["sequence_ledger"] = [
            richie,
            expose,
            trophy,
            *[
                {**row, "order": index}
                for index, row in enumerate(
                    audit["sequence_ledger"][1:], start=4
                )
            ],
        ]

        reconciled = cv._reconcile_literal_sequence_claims(audit, coverage)

        cross_field = next(
            row for row in reconciled["verdicts"]
            if row["claim_id"] == "guard.cross_field_consistency"
        )
        self.assertEqual(cross_field["classification"], "unsupported")
        self.assertIn(
            "Richie",
            " ".join(reconciled["sequence_normalization_diagnostics"]),
        )
        reconciled["sequence_evidence"] = [
            {
                "field_path": "sequence_ledger[1]",
                "classification": "supported",
                "grounding_valid": True,
            },
            {
                "field_path": "sequence_ledger[2]",
                "classification": "unclassified",
                "grounding_status": "unresolved",
                "grounding_valid": False,
            },
            {
                "field_path": "sequence_ledger[3]",
                "classification": "supported",
                "grounding_valid": True,
            },
        ]
        by_claim = {
            row["claim_id"]: row for row in reconciled["verdicts"]
        }
        self.assertNotIn(
            "guard.cross_field_consistency",
            cv._fact_repair_targets(by_claim, reconciled, []),
        )
        reconciled["sequence_evidence"][1].update({
            "classification": "supported",
            "grounding_status": "grounded",
            "grounding_valid": True,
        })
        self.assertIn(
            "guard.cross_field_consistency",
            cv._fact_repair_targets(by_claim, reconciled, []),
        )
        reconciled["sequence_evidence"][0].update({
            "classification": "unclassified",
            "grounding_status": "unresolved",
            "grounding_valid": False,
        })
        self.assertNotIn(
            "guard.cross_field_consistency",
            cv._fact_repair_targets(by_claim, reconciled, []),
        )

    def test_cosquillitas_missing_richie_event_fails_closed(self):
        coverage = valid_coverage()
        coverage["story_spine"]["ending"] = (
            "Richie reunites with Lucesita and receives her wig."
        )
        audit = supported_audit(coverage)
        source = """[PAGE 1]
RICHIE
Richie waits with Lucesita.
LUCESITA
Lucesita answers Richie.
SECURITY
Security watches. When Richie asks, Busca remains prose.
[PAGE 2]
RICHIE
Richie returns to Lucesita.
LUCESITA
Lucesita greets Richie.
SECURITY
Security leaves.
"""
        self.assertEqual(
            cv._screenplay_character_name_tokens(source),
            {"richie", "lucesita"},
        )

        reconciled = cv._reconcile_literal_sequence_claims(
            audit, coverage, source
        )

        cross_field = next(
            row for row in reconciled["verdicts"]
            if row["claim_id"] == "guard.cross_field_consistency"
        )
        self.assertEqual(cross_field["classification"], "unsupported")
        self.assertTrue(any(
            row.get("kind") == "missing_spine_event"
            and "Richie" in row.get("actors", [])
            and row.get("affected_orders") == []
            for row in reconciled["deterministic_sequence_mismatches"]
        ))
        self.assertNotIn(
            "guard.cross_field_consistency",
            cv._fact_repair_targets(
                {row["claim_id"]: row for row in reconciled["verdicts"]},
                reconciled,
                [],
            ),
        )

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

    def test_three_remaining_calls_complete_fact_repair_core_and_detail(self):
        coverage = valid_coverage()
        audit = supported_audit(coverage)
        audit["verdicts"][0].update({
            "classification": "partially_supported",
            "note": "The protagonist wording is vague.",
        })
        corrected = copy.deepcopy(coverage)
        corrected["story_spine"]["protagonist"] = (
            "Diego Salas, retired goalkeeper"
        )
        corrected["strengths"][0] = {
            "point": (
                "El penal de Tepito presenta la capacidad de Diego con acción"
            ),
            "page": 2,
            "excerpt": "Diego detiene el penal con una sola mano",
        }
        reaudit_core = provider_audit_core(corrected)
        reaudit_core["sequence_ledger"] = copy.deepcopy(
            audit["sequence_ledger"]
        )
        normalized_reaudit = cv.normalize_audit_tool_input(
            copy.deepcopy(reaudit_core), range(1, 7)
        )
        corrected_checks = cv.build_existing_evidence_checks(
            corrected, SCREENPLAY_TEXT
        )
        corrected_rows = cv.build_detail_audit_rows(
            corrected,
            corrected_checks,
            normalized_reaudit["sequence_ledger"],
        )
        _seeded_evidence, _seeded_citations, pending = (
            cv._reusable_detail_seed(
                coverage,
                cv.build_existing_evidence_checks(
                    coverage, SCREENPLAY_TEXT
                ),
                audit,
                corrected_rows,
            )
        )
        self.assertTrue(pending)
        transport = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (corrected, settled_usage()),
            (reaudit_core, settled_usage()),
            (typed_detail_payload_for_rows(pending), settled_usage()),
        ])

        report, _usage = run_engine(
            new_store(), transport, max_calls=5, max_cost_usd=5.0
        )

        self.assertEqual(report["status"], "sealed")
        self.assertEqual(
            [call["stage"] for call in transport.calls],
            [
                "coverage_v1.coverage",
                "coverage_v1.fact_audit",
                "coverage_v1.fact_repair",
                "coverage_v1.fact_reaudit",
                "coverage_v1.fact_reaudit_details",
            ],
        )

    def test_two_remaining_calls_do_not_start_fresh_fact_repair(self):
        coverage = valid_coverage()
        audit = supported_audit(coverage)
        audit["verdicts"][0].update({
            "classification": "partially_supported",
            "note": "The protagonist wording is vague.",
        })
        transport = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
        ])

        report, _usage = run_engine(
            new_store(), transport, max_calls=4, max_cost_usd=5.0
        )

        self.assertEqual(report["status"], "needs_review")
        self.assertEqual(len(transport.calls), 2)
        self.assertFalse(report["diagnostics"]["fact_repair"]["attempted"])

    def test_scope_retry_defers_at_cap_and_same_cap_resume_is_no_spend(self):
        coverage = valid_coverage()
        audit = supported_audit(coverage)
        audit["verdicts"][0].update({
            "classification": "partially_supported",
            "note": "The protagonist wording is vague.",
        })
        corrected = copy.deepcopy(coverage)
        corrected["story_spine"]["protagonist"] = (
            "Diego Salas, retired goalkeeper"
        )
        corrected["concerns"][0]["point"] = (
            "On p.4, Román Vega threatens the field, but no motive is "
            "established anywhere in the screenplay."
        )
        store = new_store()
        first = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (corrected, settled_usage()),
        ])

        report, _usage = run_engine(
            store, first, max_calls=5, max_cost_usd=5.0
        )

        self.assertEqual(report["status"], "needs_review")
        self.assertEqual(
            [call["stage"] for call in first.calls],
            [
                "coverage_v1.coverage",
                "coverage_v1.fact_audit",
                "coverage_v1.fact_repair",
            ],
        )
        self.assertTrue(
            report["diagnostics"]["fact_repair"][
                "scope_repair_deferred_at_call_cap"
            ]
        )
        budget_path = next(store.root.glob("*/budget.json"))
        receipts_path = next(store.root.glob("*/call_receipts.json"))
        before = (budget_path.read_bytes(), receipts_path.read_bytes())

        replay = FakeTransport([])
        replayed, usage = run_engine(
            store, replay, max_calls=5, max_cost_usd=5.0
        )

        self.assertEqual(replayed["status"], "needs_review")
        self.assertEqual(replay.calls, [])
        self.assertEqual(usage["call_count"], 0)
        self.assertEqual(
            (budget_path.read_bytes(), receipts_path.read_bytes()), before
        )


class TestBudget(unittest.TestCase):
    def test_sequential_receipts_repair_missing_budget_settlement(self):
        store = new_store()
        binding = {"fixture": "receipt-reconciliation"}
        key = cv.canonical_json_hash(binding)
        store.save(key, "budget", cv._sealed_record(binding, {
            "budget_ledger_version": cv.BUDGET_LEDGER_VERSION,
            "calls_started": 0,
            "usage": {},
            "in_flight": None,
        }))
        fingerprint = "1" * 64
        store.save(key, "call_receipts", cv._sealed_record(binding, {
            "call_receipt_version": cv.CALL_RECEIPT_VERSION,
            "receipts": {
                fingerprint: {
                    "stage": "coverage_v1.literal_sequence_retry",
                    "call_number": 1,
                    "tool_input": {"sequence_ledger": {}},
                    "text": "",
                    "usage": settled_usage(109_035),
                    "failure": None,
                },
            },
        }))

        guard = cv._CostGuard(0.2, 2, store, key, binding)

        self.assertEqual(guard.calls_started, 1)
        self.assertEqual(guard.charged_microusd, 109_035)
        self.assertTrue(guard.capacity_exhausted_for(100_000))
        self.assertIsNotNone(guard.replay_call(
            fingerprint, "coverage_v1.literal_sequence_retry"
        ))
        self.assertEqual(guard.charged_microusd, 109_035)

        gap_store = new_store()
        gap_key = cv.canonical_json_hash({"fixture": "receipt-gap"})
        gap_binding = {"fixture": "receipt-gap"}
        gap_store.save(gap_key, "budget", cv._sealed_record(
            gap_binding,
            {
                "budget_ledger_version": cv.BUDGET_LEDGER_VERSION,
                "calls_started": 0,
                "usage": {},
                "in_flight": None,
            },
        ))
        gap_store.save(gap_key, "call_receipts", cv._sealed_record(
            gap_binding,
            {
                "call_receipt_version": cv.CALL_RECEIPT_VERSION,
                "receipts": {
                    "2" * 64: {
                        "stage": "coverage_v1.literal_sequence_retry",
                        "call_number": 2,
                        "tool_input": {},
                        "text": "",
                        "usage": settled_usage(),
                        "failure": None,
                    },
                },
            },
        ))
        with self.assertRaisesRegex(
            cv.CheckpointTamperedError, "settlement gap"
        ):
            cv._CostGuard(1.0, 3, gap_store, gap_key, gap_binding)

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


class TestPostDetailSequenceRepair(unittest.TestCase):
    @staticmethod
    def _event_bundle_fixture():
        source = {
            "sequence_ledger": [
                {
                    "order": 1,
                    "phase": "ending",
                    "page": 6,
                    "actor": "Diego",
                    "action": "Diego lifts the trophy.",
                    "result": "The crowd applauds Diego.",
                    "character_knowledge": "Diego knows he won.",
                    "audience_knowledge": "The crowd sees Diego win.",
                },
                {
                    "order": 2,
                    "phase": "ending",
                    "page": 6,
                    "actor": "Roman",
                    "action": "Roman leaves the field.",
                    "result": "Roman exits alone.",
                    "character_knowledge": "Roman knows he lost.",
                    "audience_knowledge": "The crowd sees Roman leave.",
                },
            ],
            "sequence_evidence": [],
            "verdicts": [],
        }
        plan = [
            {
                "slot": f"sequence_{order:03d}_{field}",
                "ledger_index": order - 1,
                "order": order,
                "field": field,
                "field_path": f"sequence_ledger[order={order}].{field}",
                "prior_value": source["sequence_ledger"][order - 1][field],
                "reasons": ["failed source-grounding check"],
            }
            for order in (1, 2)
            for field in ("action", "result")
        ]
        return source, plan

    def _repair_fixture(self):
        coverage = valid_coverage()
        provider_core = provider_audit_core(coverage)
        bad = provider_core["sequence_ledger"]["climax"][0]
        bad["character_knowledge"] = "NOT LOCATED"
        page_map = cv.build_page_reference_map(SCREENPLAY_TEXT, 6, None)
        normalized = cv.normalize_audit_tool_input(
            copy.deepcopy(provider_core), page_map["valid_citation_pages"]
        )
        evidence_checks = cv.build_existing_evidence_checks(
            coverage, SCREENPLAY_TEXT
        )
        rows = cv.build_detail_audit_rows(
            coverage, evidence_checks, normalized["sequence_ledger"]
        )
        first_detail = detail_payload_for_rows(rows, SCREENPLAY_TEXT)
        evidence, citations = cv.decode_detail_audit_payload(
            first_detail, rows, SCREENPLAY_TEXT
        )
        source_audit = cv._replace_audit_details(
            normalized, evidence, citations, evidence_checks
        )
        source_audit = cv._reconcile_literal_sequence_claims(
            source_audit, coverage
        )
        plan, blockers = cv._post_detail_sequence_repair_plan(source_audit)
        self.assertFalse(blockers)
        good_ledger = cv.normalize_audit_tool_input(
            provider_audit_core(coverage),
            page_map["valid_citation_pages"],
        )["sequence_ledger"]
        good_by_order = {
            beat["order"]: beat for beat in good_ledger
        }
        good_by_order[1]["action"] = (
            "Diego detiene el último penal de la final y se desploma sobre "
            "el pasto."
        )
        good_by_order[3].update({
            "action": "Diego sees that he survives and stays as coach.",
            "result": "Diego survives and stays as coach.",
        })
        repair = {
            "repairs": [
                {
                    "slot": item["slot"],
                    "corrected_value": (
                        good_by_order[item["order"]][item["field"]]
                    ),
                }
                for item in plan
            ]
        }
        candidate, _paths = cv._apply_post_detail_sequence_repairs(
            source_audit, repair, plan
        )
        _all, _evidence, _citations, pending = (
            cv._post_detail_sequence_repair_rows(
                coverage,
                evidence_checks,
                source_audit,
                candidate,
                plan,
            )
        )
        return coverage, provider_core, first_detail, plan, repair, pending

    def test_material_claim_atoms_keep_exact_clause_spans(self):
        beat = {
            "action": (
                "Richie declares his love and says twenty years have passed, "
                "then he gives Lucesita the wig."
            ),
            "result": "The public sings along and celebrates.",
        }

        atoms = cv._sequence_material_claim_atoms(beat)

        self.assertEqual(
            [atom["text"] for atom in atoms if atom["field"] == "action"],
            [
                "Richie declares his love",
                "says twenty years have passed",
                "then he gives Lucesita the wig.",
            ],
        )
        self.assertEqual(
            [atom["text"] for atom in atoms if atom["field"] == "result"],
            ["The public sings along", "celebrates."],
        )
        for atom in atoms:
            scalar = beat[atom["field"]]
            self.assertEqual(
                scalar[atom["start"]:atom["end"]], atom["text"]
            )
            self.assertEqual(
                atom["claim_sha256"], cv.canonical_json_hash({
                    "field": atom["field"],
                    "start": atom["start"],
                    "end": atom["end"],
                    "text": atom["text"],
                })
            )

        nested = cv._sequence_material_claim_atoms({
            "action": (
                "Video shows gifts (cash, lingerie and a poster), then "
                "security detains them."
            ),
            "result": (
                "They leave to 'el mejor y mas cálido aplauso de la gente'."
            ),
        })
        self.assertEqual(
            [atom["text"] for atom in nested],
            [
                "Video shows gifts (cash, lingerie and a poster)",
                "then security detains them.",
                "They leave to 'el mejor y mas cálido aplauso de la gente'.",
            ],
        )

    def _atomic_repair_fixture(self):
        text = (
            "[PAGE 6]\n"
            "Richie declares his love.\n"
            "Richie says he has loved Lucesita for five years.\n"
            "Lucesita accepts Richie's love.\n"
        )
        beat = {
            "order": 1,
            "phase": "ending",
            "page": 6,
            "actor": "Richie",
            "action": (
                "Richie declares his love; Richie says he has loved Lucesita "
                "for ten years."
            ),
            "result": "Lucesita accepts Richie's love.",
            "character_knowledge": "Richie knows Lucesita accepts his love.",
            "audience_knowledge": "The audience sees Lucesita accept his love.",
        }
        row = cv.build_detail_audit_rows({}, [], [beat])[0]
        atoms = row["subject"]["material_claim_atoms"]
        by_id = {atom["atom_id"]: atom for atom in atoms}
        raw = {
            "material_atom_results": [
                {
                    "atom_id": "action_001",
                    "disposition": "supported",
                    "source_id": f"{row['slot']}:action_001:p006-l001",
                },
                {
                    "atom_id": "action_002",
                    "disposition": "contradicted",
                    "source_id": f"{row['slot']}:action_002:p006-l002",
                },
                {
                    "atom_id": "result_001",
                    "disposition": "supported",
                    "source_id": f"{row['slot']}:result_001:p006-l003",
                },
            ],
        }
        normalized, reason = cv._decode_sequence_material_atom_results(
            raw,
            row,
            text,
            {
                "action": {"supports": False},
                "result": {"supports": True},
            },
        )
        self.assertIsNone(reason)
        self.assertEqual(len(normalized or []), len(atoms))
        audit = {
            "sequence_ledger": [beat],
            "sequence_evidence": [{
                "field_path": "sequence_ledger[1]",
                "classification": "partially_supported",
                "grounding_valid": True,
                "checks": [
                    {"field": "action", "supports": False},
                    {"field": "result", "supports": True},
                ],
                "material_atom_results": normalized,
                "claim_sha256": "claim-one",
                "row_identity": "row-one",
            }],
            "verdicts": [],
        }
        plan, blockers = cv._post_detail_sequence_repair_plan(audit)
        self.assertFalse(blockers)
        self.assertEqual(len(plan), 1)
        self.assertEqual(plan[0]["atom_id"], "action_002")
        self.assertEqual(
            plan[0]["prior_value"], by_id["action_002"]["text"]
        )
        repair = {
            "atom_repairs": [{
                "slot": plan[0]["slot"],
                "old_fragment": plan[0]["prior_value"],
                "replacement": (
                    "Richie says he has loved Lucesita for five years."
                ),
                "source_id": (
                    f"{plan[0]['slot']}:replacement:p006-l002"
                ),
            }],
        }
        return text, audit, row, plan, repair

    def test_atomic_provenance_targets_only_failed_fragment(self):
        text, audit, row, plan, repair = self._atomic_repair_fixture()

        tool = cv.build_post_detail_sequence_repair_tool(plan)
        self.assertEqual(
            tool["input_schema"]["required"], ["atom_repairs"]
        )
        corrected, paths = cv._apply_post_detail_sequence_repairs(
            audit, repair, plan, source_text=text
        )

        self.assertEqual(paths, [plan[0]["field_path"]])
        self.assertEqual(
            corrected["sequence_ledger"][0]["action"],
            (
                "Richie declares his love; Richie says he has loved "
                "Lucesita for five years."
            ),
        )
        self.assertEqual(
            cv._sequence_protected_event_inventory(audit, plan),
            cv._sequence_protected_event_inventory(corrected, plan),
        )
        _all, _evidence, _citations, pending = (
            cv._post_detail_sequence_repair_rows(
                {}, [], audit, corrected, plan
            )
        )
        repaired_row = next(
            pending_row for pending_row in pending
            if pending_row["identifier"] == row["identifier"]
        )
        self.assertTrue(
            repaired_row["subject"]["required_material_atom_reaudit"]
        )
        self.assertEqual(
            " ".join(
                atom["text"]
                for atom in repaired_row["subject"]["material_claim_atoms"]
                if atom["field"] == "action"
            ),
            (
                "Richie declares his love Richie says he has loved Lucesita "
                "for five years."
            ),
        )

    def test_scalar_repair_reaudits_previously_failed_compound_atoms(self):
        text, audit, row, _plan, _repair = self._atomic_repair_fixture()
        failed_atom = audit["sequence_evidence"][0][
            "material_atom_results"
        ][1]
        failed_atom.update({
            "disposition": "supported",
            "page": 6,
            "excerpt": "Richie says he has loved Lucesita for years.",
            "source_anchor_id": "p006-l002",
        })
        candidate = copy.deepcopy(audit)
        candidate["sequence_ledger"][0]["character_knowledge"] = (
            cv.SEQUENCE_KNOWLEDGE_NOT_APPLICABLE
        )
        scalar_plan = [{
            "repair_kind": "scalar",
            "slot": "sequence_001_character_knowledge",
            "ledger_index": 0,
            "order": 1,
            "field": "character_knowledge",
            "field_path": (
                "sequence_ledger[order=1].character_knowledge"
            ),
            "prior_value": audit["sequence_ledger"][0][
                "character_knowledge"
            ],
            "prior_grounding_not_located": True,
            "reasons": ["failed source-grounding check"],
        }]

        _all, _evidence, _citations, pending = (
            cv._post_detail_sequence_repair_rows(
                {}, [], audit, candidate, scalar_plan
            )
        )

        repaired_row = next(
            value for value in pending
            if value["identifier"] == row["identifier"]
        )
        self.assertTrue(
            repaired_row["subject"]["required_material_atom_reaudit"]
        )

    def test_atomic_repair_rejects_fragment_or_supported_sibling_changes(self):
        text, audit, _row, plan, repair = self._atomic_repair_fixture()
        malformed = copy.deepcopy(repair)
        malformed["atom_repairs"][0]["old_fragment"] = "twenty years"
        with self.assertRaisesRegex(
            cv.CoverageContractError, "frozen source fragment"
        ):
            cv._apply_post_detail_sequence_repairs(
                audit, malformed, plan, source_text=text
            )

        corrected, _paths = cv._apply_post_detail_sequence_repairs(
            audit, repair, plan, source_text=text
        )
        corrected["sequence_ledger"][0]["action"] = corrected[
            "sequence_ledger"
        ][0]["action"].replace("declares", "professes")
        self.assertNotEqual(
            cv._sequence_protected_event_inventory(audit, plan),
            cv._sequence_protected_event_inventory(corrected, plan),
        )

        changed_source = copy.deepcopy(repair)
        changed_source["atom_repairs"][0]["source_id"] = (
            f"{plan[0]['slot']}:replacement:p006-l001"
        )
        with self.assertRaisesRegex(
            cv.CoverageContractError, "changed its contradiction source"
        ):
            cv._apply_post_detail_sequence_repairs(
                audit, changed_source, plan, source_text=text
            )

    def test_atomic_repair_blocks_missing_or_unresolved_provenance(self):
        _text, audit, _row, _plan, _repair = self._atomic_repair_fixture()
        missing = copy.deepcopy(audit)
        missing["sequence_evidence"][0].pop("material_atom_results")
        plan, blockers = cv._post_detail_sequence_repair_plan(missing)
        self.assertFalse(plan)
        self.assertTrue(any("atomic provenance" in item for item in blockers))

        unresolved = copy.deepcopy(audit)
        atom = unresolved["sequence_evidence"][0]["material_atom_results"][1]
        atom["disposition"] = "unresolved"
        plan, blockers = cv._post_detail_sequence_repair_plan(unresolved)
        self.assertFalse(plan)
        self.assertTrue(any("unresolved atom" in item for item in blockers))

        not_located = copy.deepcopy(audit)
        atom = not_located["sequence_evidence"][0][
            "material_atom_results"
        ][1]
        atom["disposition"] = "not_located"
        for field in ("page", "excerpt", "source_anchor_id"):
            atom.pop(field, None)
        plan, blockers = cv._post_detail_sequence_repair_plan(not_located)
        self.assertFalse(plan)
        self.assertTrue(any(
            "NOT_LOCATED atom(s) requiring human review" in item
            for item in blockers
        ))

    def test_atomic_repair_cannot_swap_in_a_different_true_event(self):
        source = (
            "[PAGE 6]\n"
            "Tony enters the room.\n"
            "Tony steals Diego's trophy.\n"
            "Tony steals Carlos's car.\n"
            "Diego watches Tony leave.\n"
        )
        beat = {
            "order": 1,
            "phase": "ending",
            "page": 6,
            "actor": "Tony",
            "action": (
                "Tony enters the room, then Tony steals Diego's trophy."
            ),
            "result": "Tony remains in the room.",
            "character_knowledge": "Tony knows he entered the room.",
            "audience_knowledge": "The audience sees Tony enter the room.",
        }
        atoms = cv._sequence_material_claim_atoms(beat)
        by_id = {atom["atom_id"]: atom for atom in atoms}
        audit = {
            "sequence_ledger": [beat],
            "sequence_evidence": [{
                "field_path": "sequence_ledger[1]",
                "classification": "partially_supported",
                "grounding_valid": True,
                "checks": [
                    {"field": "actor", "supports": True},
                    {"field": "action", "supports": False},
                    {"field": "result", "supports": True},
                    {"field": "character_knowledge", "supports": True},
                    {"field": "audience_knowledge", "supports": True},
                ],
                "material_atom_results": [
                    {
                        **by_id["action_001"],
                        "disposition": "supported",
                        "page": 6,
                        "excerpt": "Tony enters the room",
                        "source_anchor_id": "p006-l001",
                    },
                    {
                        **by_id["action_002"],
                        "disposition": "contradicted",
                        "page": 6,
                        "excerpt": "Tony steals Carlos's car",
                        "source_anchor_id": "p006-l003",
                    },
                ],
                "claim_sha256": "claim-one",
                "row_identity": "row-one",
            }],
            "verdicts": [],
        }
        plan, blockers = cv._post_detail_sequence_repair_plan(audit)
        self.assertFalse(plan)
        self.assertTrue(any(
            "changes participant roles and requires human review" in item
            for item in blockers
        ))
        self.assertFalse(cv._sequence_same_repair_event(
            "Tony steals Diego's trophy.",
            "Tony steals Carlos's car.",
        ))
        self.assertFalse(cv._sequence_same_repair_event(
            "Tony steals Diego's trophy.",
            "Tony steals Diego's car.",
        ))
        self.assertFalse(cv._sequence_same_repair_event(
            "Tony gives Diego two trophies.",
            "Diego gives Tony three trophies.",
        ))
        self.assertFalse(cv._sequence_same_repair_event(
            "Tony enters Diego's house.",
            "Diego exits Tony's house.",
        ))
        self.assertFalse(cv._sequence_same_repair_event(
            "Tony wins two trophies.",
            "Tony wins three trophies; wins trophies.",
        ))
        self.assertFalse(cv._sequence_same_repair_event(
            "Tony does not win the trophy.",
            "Tony wins the trophy; wins the trophy.",
        ))
        self.assertFalse(cv._sequence_same_repair_event(
            "Tony wins two trophies.",
            "Tony wins three trophies / wins trophies.",
        ))
        self.assertFalse(cv._sequence_same_repair_event(
            "Tony wins two trophies.",
            "Tony wins three trophies (wins trophies).",
        ))
        self.assertFalse(cv._sequence_same_repair_event(
            "Tony enters the house.",
            "Tony exits the house / exits the house.",
        ))
        self.assertFalse(cv._sequence_same_repair_event(
            "Tony stops, killing two guards.",
            "Tony stops killing three guards.",
        ))

    def test_numbered_identity_is_not_a_repairable_quantity(self):
        cases = (
            (
                "Tony enters the room, then Judge 1 gives Tony the trophy.",
                "then Judge 2 gives Tony the trophy.",
            ),
            (
                "Tony entra al cuarto, luego Juez 1 entrega el trofeo a "
                "Tony.",
                "luego Juez 2 entrega el trofeo a Tony.",
            ),
        )
        for action, contradiction in cases:
            with self.subTest(action=action):
                beat = {
                    "order": 1,
                    "phase": "ending",
                    "page": 6,
                    "actor": "Tony and Judge 1",
                    "action": action,
                    "result": "Tony keeps the trophy.",
                    "character_knowledge": (
                        "Tony knows he has the trophy."
                    ),
                    "audience_knowledge": (
                        "The audience sees Tony receive the trophy."
                    ),
                }
                atoms = {
                    atom["atom_id"]: atom
                    for atom in cv._sequence_material_claim_atoms(beat)
                }
                audit = {
                    "sequence_ledger": [beat],
                    "sequence_evidence": [{
                        "field_path": "sequence_ledger[1]",
                        "classification": "partially_supported",
                        "grounding_valid": True,
                        "checks": [
                            {"field": "actor", "supports": True},
                            {"field": "action", "supports": False},
                            {"field": "result", "supports": True},
                            {
                                "field": "character_knowledge",
                                "supports": True,
                            },
                            {
                                "field": "audience_knowledge",
                                "supports": True,
                            },
                        ],
                        "material_atom_results": [
                            {
                                **atoms["action_001"],
                                "disposition": "supported",
                                "page": 6,
                                "excerpt": atoms["action_001"]["text"],
                                "source_anchor_id": "p006-l001",
                            },
                            {
                                **atoms["action_002"],
                                "disposition": "contradicted",
                                "page": 6,
                                "excerpt": contradiction,
                                "source_anchor_id": "p006-l002",
                            },
                        ],
                        "claim_sha256": "claim-one",
                        "row_identity": "row-one",
                    }],
                    "verdicts": [],
                }

                plan, blockers = cv._post_detail_sequence_repair_plan(audit)

                self.assertFalse(plan)
                self.assertTrue(any(
                    "does not preserve one event" in blocker
                    for blocker in blockers
                ))
        self.assertFalse(cv._sequence_same_repair_event(
            "Guard 1 arrests Tony.", "Guard 2 arrests Tony."
        ))
        self.assertFalse(cv._sequence_same_repair_event(
            "Tony enters room 1.", "Tony enters room 2."
        ))
        self.assertFalse(cv._sequence_same_repair_event(
            "Tony enters room one.", "Tony enters room two."
        ))
        self.assertFalse(cv._sequence_same_repair_event(
            "camera 1 records Tony.", "camera 2 records Tony."
        ))
        self.assertFalse(cv._sequence_same_repair_event(
            "Tony uses first camera.", "Tony uses second camera."
        ))
        self.assertFalse(cv._sequence_same_repair_event(
            "Tony boards flight AA1.", "Tony boards flight AA2."
        ))
        for separator in (
            "-", "/", "#", "_", ".", " ", "‑", "−",
        ):
            with self.subTest(device_code_separator=separator):
                self.assertFalse(cv._sequence_same_repair_event(
                    f"Tony uses camera A{separator}1.",
                    f"Tony uses camera A{separator}2.",
                ))
        for separator in ("-", " "):
            with self.subTest(word_device_code_separator=separator):
                self.assertFalse(cv._sequence_same_repair_event(
                    f"Tony uses camera A{separator}one.",
                    f"Tony uses camera A{separator}two.",
                ))
        self.assertFalse(cv._sequence_same_repair_event(
            "Tony uses camera 1.1.", "Tony uses camera 1.2."
        ))
        for left, right in (("(1)", "(2)"), ("[1]", "[2]"), ("“1”", "“2”")):
            with self.subTest(bracketed_device_code=left):
                self.assertFalse(cv._sequence_same_repair_event(
                    f"Tony uses camera {left}.",
                    f"Tony uses camera {right}.",
                ))
        for claim, replacement in (
            (
                "Tony chooses two as the access code.",
                "Tony chooses three as the access code.",
            ),
            (
                "Tony selects two for the channel.",
                "Tony selects three for the channel.",
            ),
            (
                "Tony presses two on the keypad.",
                "Tony presses three on the keypad.",
            ),
        ):
            with self.subTest(selected_numeric_identifier=claim):
                self.assertFalse(cv._sequence_same_repair_event(
                    claim, replacement
                ))
        for claim, replacement in (
            (
                "Tony visits the 'two guards' bar.",
                "Tony visits the 'three guards' bar.",
            ),
            (
                "Tony watches the “two trophies” show.",
                "Tony watches the “three trophies” show.",
            ),
            (
                "Tony joins the [two guards] club.",
                "Tony joins the [three guards] club.",
            ),
        ):
            with self.subTest(count_shaped_name=claim):
                self.assertFalse(cv._sequence_same_repair_event(
                    claim, replacement
                ))
        self.assertFalse(cv._sequence_same_repair_event(
            "Tony watches 12 Years a Slave.",
            "Tony watches 13 Years a Slave.",
        ))
        self.assertFalse(cv._sequence_same_repair_event(
            "Tony boards the 10-Year Bus.",
            "Tony boards the 5-Year Bus.",
        ))
        self.assertFalse(cv._sequence_same_repair_event(
            "Tony uses camera №1 while watching 12 Years a Slave.",
            "Tony uses camera №1 while watching 13 Years a Slave.",
        ))
        self.assertFalse(cv._sequence_same_repair_event(
            "Tony reads the ﬁle, then watches 12 Years a Slave.",
            "Tony reads the ﬁle, then watches 13 Years a Slave.",
        ))
        self.assertTrue(cv._sequence_same_repair_event(
            "Tony wins two trophies.", "Tony wins three trophies."
        ))
        self.assertTrue(cv._sequence_same_repair_event(
            "Tony kills two guards.", "Tony kills three guards."
        ))
        self.assertTrue(cv._sequence_same_repair_event(
            "Tony waits ten years.", "Tony waits five years."
        ))

    def test_plan_uses_unique_order_and_targets_unlocated_knowledge(self):
        coverage = valid_coverage()
        audit = supported_audit(coverage)
        row = next(
            value for value in audit["sequence_evidence"]
            if value["field_path"] == "sequence_ledger[2]"
        )
        row.update({
            "classification": "unsupported",
            "grounding_valid": True,
            "checks": [{"field": "actor", "supports": False}],
            "row_identity": "row-two",
        })
        audit["sequence_ledger"][2]["character_knowledge"] = "NOT LOCATED"

        plan, blockers = cv._post_detail_sequence_repair_plan(audit)

        self.assertFalse(blockers)
        by_slot = {item["slot"]: item for item in plan}
        self.assertEqual(by_slot["sequence_002_actor"]["ledger_index"], 1)
        self.assertEqual(
            by_slot["sequence_002_actor"]["field_path"],
            "sequence_ledger[order=2].actor",
        )
        self.assertIn("sequence_003_character_knowledge", by_slot)
        self.assertNotIn(
            "prior_grounding_not_located",
            by_slot["sequence_003_character_knowledge"],
        )

    def test_plan_blocks_automatic_rewrite_of_ungrounded_material_event(self):
        audit, _repair_plan = self._event_bundle_fixture()
        audit["sequence_evidence"] = []
        for beat in audit["sequence_ledger"]:
            checks = [
                {"field": field, "supports": True}
                for field in cv.GROUNDED_SEQUENCE_FIELDS
            ]
            if beat["order"] == 1:
                checks[1] = {"field": "action", "supports": False}
            audit["sequence_evidence"].append({
                "field_path": f"sequence_ledger[{beat['order']}]",
                "classification": (
                    "partially_supported" if beat["order"] == 1
                    else "supported"
                ),
                "grounding_valid": True,
                "checks": checks,
            })

        plan, blockers = cv._post_detail_sequence_repair_plan(audit)

        self.assertFalse(any(
            item["field"] in {"action", "result"} for item in plan
        ))
        self.assertIn(
            "sequence material event order 1 has ungrounded action; "
            "atomic provenance is incomplete",
            blockers,
        )

    def test_not_applicable_is_exact_and_engine_authorized(self):
        coverage = valid_coverage()
        claims = cv.build_audit_claims(coverage)
        page_map = cv.build_page_reference_map(SCREENPLAY_TEXT, 6, None)
        checks = cv.build_existing_evidence_checks(
            coverage, SCREENPLAY_TEXT
        )
        audit = supported_audit(coverage)
        audit["sequence_ledger"][1]["character_knowledge"] = (
            cv.SEQUENCE_KNOWLEDGE_NOT_APPLICABLE
        )
        problems = cv.validate_audit_payload(
            audit, claims, coverage, page_map, checks
        )
        self.assertTrue(any("unauthorized NOT APPLICABLE" in p for p in problems))

        audit["_sequence_repair_authorized_not_applicable_orders"] = [2]
        problems = cv.validate_audit_payload(
            audit, claims, coverage, page_map, checks
        )
        self.assertFalse(any("unauthorized NOT APPLICABLE" in p for p in problems))
        self.assertFalse(any("invalid knowledge structure" in p for p in problems))

        audit["sequence_ledger"][1]["character_knowledge"] = "not applicable"
        problems = cv.validate_audit_payload(
            audit, claims, coverage, page_map, checks
        )
        self.assertTrue(any("invalid knowledge structure" in p for p in problems))

    def test_not_applicable_requires_confirmed_absence_and_no_staged_knowledge(self):
        source, _plan = self._event_bundle_fixture()
        no_knowledge_source = "[PAGE 6]\nDiego lifts the trophy.\n"
        beat = source["sequence_ledger"][0]
        beat["character_knowledge"] = "Diego knows a secret plan."
        item = {
            "slot": "sequence_001_character_knowledge",
            "ledger_index": 0,
            "order": 1,
            "field": "character_knowledge",
            "field_path": "sequence_ledger[order=1].character_knowledge",
            "prior_value": beat["character_knowledge"],
            "reasons": ["failed source-grounding check"],
            "prior_grounding_not_located": True,
        }
        repaired, _paths = cv._apply_post_detail_sequence_repairs(
            source,
            {"repairs": [{
                "slot": item["slot"],
                "corrected_value": cv.SEQUENCE_KNOWLEDGE_NOT_APPLICABLE,
            }]},
            [item],
            source_text=no_knowledge_source,
        )
        self.assertEqual(
            repaired["sequence_ledger"][0]["character_knowledge"],
            cv.SEQUENCE_KNOWLEDGE_NOT_APPLICABLE,
        )
        unverified = copy.deepcopy(item)
        unverified.pop("prior_grounding_not_located")
        with self.assertRaisesRegex(
            cv.CoverageContractError, "cannot erase"
        ):
            cv._apply_post_detail_sequence_repairs(
                source,
                {"repairs": [{
                    "slot": item["slot"],
                    "corrected_value": cv.SEQUENCE_KNOWLEDGE_NOT_APPLICABLE,
                }]},
                [unverified],
                source_text=no_knowledge_source,
            )
        raw_not_located = copy.deepcopy(item)
        raw_not_located["prior_value"] = "NOT LOCATED"
        raw_not_located.pop("prior_grounding_not_located")
        source["sequence_ledger"][0]["character_knowledge"] = "NOT LOCATED"
        with self.assertRaisesRegex(
            cv.CoverageContractError, "cannot erase"
        ):
            cv._apply_post_detail_sequence_repairs(
                source,
                {"repairs": [{
                    "slot": item["slot"],
                    "corrected_value": cv.SEQUENCE_KNOWLEDGE_NOT_APPLICABLE,
                }]},
                [raw_not_located],
                source_text=no_knowledge_source,
            )
        raw_not_located["prior_grounding_not_located"] = True
        repaired, _paths = cv._apply_post_detail_sequence_repairs(
            source,
            {"repairs": [{
                "slot": item["slot"],
                "corrected_value": cv.SEQUENCE_KNOWLEDGE_NOT_APPLICABLE,
            }]},
            [raw_not_located],
            source_text=no_knowledge_source,
        )
        self.assertEqual(
            repaired["sequence_ledger"][0]["character_knowledge"],
            cv.SEQUENCE_KNOWLEDGE_NOT_APPLICABLE,
        )
        staged_knowledge = copy.deepcopy(item)
        staged_source = copy.deepcopy(source)
        staged_source["sequence_ledger"][0].update({
            "action": "Diego learns that Roman fixed the contest.",
            "character_knowledge": item["prior_value"],
        })
        with self.assertRaisesRegex(
            cv.CoverageContractError, "cannot erase"
        ):
            cv._apply_post_detail_sequence_repairs(
                staged_source,
                {"repairs": [{
                    "slot": item["slot"],
                    "corrected_value": cv.SEQUENCE_KNOWLEDGE_NOT_APPLICABLE,
                }]},
                [staged_knowledge],
                source_text=no_knowledge_source,
            )

        screenplay_knowledge = copy.deepcopy(source)
        screenplay_knowledge["sequence_ledger"][0][
            "character_knowledge"
        ] = item["prior_value"]
        with self.assertRaisesRegex(
            cv.CoverageContractError, "cannot erase"
        ):
            cv._apply_post_detail_sequence_repairs(
                screenplay_knowledge,
                {"repairs": [{
                    "slot": item["slot"],
                    "corrected_value": cv.SEQUENCE_KNOWLEDGE_NOT_APPLICABLE,
                }]},
                [item],
                source_text=(
                    "[PAGE 6]\nDiego realizes the plan is fake.\n"
                ),
            )
        for staged_source_text in (
            "[PAGE 6]\nDiego abre la carta.\nSe da cuenta del engaño.\n",
            "[PAGE 6]\nDiego opens the letter.\nHe realizes the fraud.\n",
        ):
            with self.subTest(staged_source_text=staged_source_text):
                with self.assertRaisesRegex(
                    cv.CoverageContractError, "cannot erase"
                ):
                    cv._apply_post_detail_sequence_repairs(
                        screenplay_knowledge,
                        {"repairs": [{
                            "slot": item["slot"],
                            "corrected_value": (
                                cv.SEQUENCE_KNOWLEDGE_NOT_APPLICABLE
                            ),
                        }]},
                        [item],
                        source_text=staged_source_text,
                    )

    def test_not_applicable_uses_the_same_call_corrected_actor(self):
        source, _plan = self._event_bundle_fixture()
        source["sequence_ledger"][0].update({
            "actor": "Roman",
            "character_knowledge": "Roman knows a secret plan.",
        })
        actor_item = {
            "slot": "sequence_001_actor",
            "ledger_index": 0,
            "order": 1,
            "field": "actor",
            "field_path": "sequence_ledger[order=1].actor",
            "prior_value": "Roman",
            "reasons": ["failed source-grounding check"],
        }
        knowledge_item = {
            "slot": "sequence_001_character_knowledge",
            "ledger_index": 0,
            "order": 1,
            "field": "character_knowledge",
            "field_path": "sequence_ledger[order=1].character_knowledge",
            "prior_value": "Roman knows a secret plan.",
            "reasons": ["failed source-grounding check"],
            "prior_grounding_not_located": True,
        }

        with self.assertRaisesRegex(
            cv.CoverageContractError, "cannot erase"
        ):
            cv._apply_post_detail_sequence_repairs(
                source,
                {"repairs": [
                    {
                        "slot": actor_item["slot"],
                        "corrected_value": "Diego",
                    },
                    {
                        "slot": knowledge_item["slot"],
                        "corrected_value": (
                            cv.SEQUENCE_KNOWLEDGE_NOT_APPLICABLE
                        ),
                    },
                ]},
                [actor_item, knowledge_item],
                source_text=(
                    "[PAGE 6]\nDiego realizes the plan is fake.\n"
                ),
            )

    def test_not_applicable_checks_each_actor_in_a_multi_actor_roster(self):
        source, _plan = self._event_bundle_fixture()
        source["sequence_ledger"][0].update({
            "actor": "Diego and Carlos",
            "character_knowledge": "Diego and Carlos know a secret plan.",
        })
        item = {
            "slot": "sequence_001_character_knowledge",
            "ledger_index": 0,
            "order": 1,
            "field": "character_knowledge",
            "field_path": "sequence_ledger[order=1].character_knowledge",
            "prior_value": "Diego and Carlos know a secret plan.",
            "reasons": ["failed source-grounding check"],
            "prior_grounding_not_located": True,
        }

        with self.assertRaisesRegex(
            cv.CoverageContractError, "cannot erase"
        ):
            cv._apply_post_detail_sequence_repairs(
                source,
                {"repairs": [{
                    "slot": item["slot"],
                    "corrected_value": cv.SEQUENCE_KNOWLEDGE_NOT_APPLICABLE,
                }]},
                [item],
                source_text=(
                    "[PAGE 6]\nCarlos realizes the truth.\n"
                ),
            )

    def test_literal_staging_can_ground_audience_knowledge(self):
        source = "[PAGE 1]\nRichie entrega la peluca a Lucesita.\n"
        beat = {
            "order": 1,
            "phase": "climax",
            "actor": "Richie",
            "action": "Richie entrega la peluca a Lucesita.",
            "result": "Richie entrega la peluca a Lucesita.",
            "character_knowledge": cv.SEQUENCE_KNOWLEDGE_NOT_APPLICABLE,
            "audience_knowledge": "Richie entrega la peluca a Lucesita.",
            "page": 1,
        }
        row = cv.build_detail_audit_rows({}, [], [beat])[0]
        source_id = next(iter(cv._source_anchor_catalog(source)))
        value = {
            "classification": "supported",
            "checks": [
                {
                    "field": field,
                    "source_id": f"{row['slot']}:{field}:{source_id}",
                    "supports": True,
                }
                for field in row["subject"]["required_fields"]
            ],
            "note": "Literal staging supports the beat.",
        }

        decoded, reason = cv._decode_grounded_detail_value(
            value, row, source
        )

        self.assertIsNone(reason)
        self.assertTrue(decoded and decoded["grounding_valid"])

    def test_depicted_or_possessive_names_cannot_ground_action_actor(self):
        cases = (
            (
                "Dante and Tony",
                "Dante and Tony footage plays on the arena screen.",
            ),
            ("Tony", "Tony footage plays on the arena screen."),
            ("Tony", "Tony's footage plays on the arena screen."),
        )
        for actor, source_line in cases:
            with self.subTest(source_line=source_line):
                source = f"[PAGE 98]\n{source_line}\n"
                beat = {
                    "order": 1,
                    "phase": "climax",
                    "actor": actor,
                    "action": f"{actor} plays footage on the arena screen.",
                    "result": "The footage appears on the arena screen.",
                    "character_knowledge": cv.SEQUENCE_KNOWLEDGE_NOT_APPLICABLE,
                    "audience_knowledge": "The audience sees the footage.",
                    "page": 98,
                }
                row = cv.build_detail_audit_rows({}, [], [beat])[0]
                value = {
                    "classification": "partially_supported",
                    "checks": [
                        {
                            "field": field,
                            "source_id": (
                                f"{row['slot']}:{field}:p098-l001"
                                if field == "actor"
                                else cv.SEQUENCE_SOURCE_NOT_LOCATED
                            ),
                            "supports": field == "actor",
                        }
                        for field in row["subject"]["required_fields"]
                    ],
                    "note": "Only the claimed actor is under test.",
                }

                decoded, reason = cv._decode_grounded_detail_value(
                    value, row, source
                )

                self.assertIsNone(decoded)
                self.assertIn("does not stage the beat actor", reason or "")

    def test_named_actor_can_still_ground_a_literal_media_action(self):
        self.assertTrue(cv._sequence_actor_leads_clause(
            "Richie", "Richie plays the footage on the arena screen."
        ))

    def test_bounded_ranges_ground_events_and_actor_ranges_narrow(self):
        source = (
            "[PAGE 1]\n"
            "El video muestra a Tony sobornando a dos jueces con regalos.\n"
            "Los dos jueces intentan escapar y seguridad los detiene.\n"
        )
        anchor = cv._sequence_source_anchor(
            source, "p001-l001-l001"
        )
        self.assertIsNotNone(anchor)
        beat = {
            "actor": "Video",
            "action": "Video shows Tony bribing two judges with gifts.",
        }
        self.assertTrue(cv._sequence_compound_range_matches(
            beat, "action", anchor["excerpt"]
        ))
        self.assertFalse(cv._sequence_compound_range_matches(
            {
                "actor": "Video",
                "action": "Video shows Tony destroying the stadium.",
            },
            "action",
            anchor["excerpt"],
        ))
        encore = (
            "[PAGE 101]\n"
            "El público pide otra canción.\n"
            "PUBLICO: ¡Otra! ¡Otra!\n"
            "Cosquillitas se vuelve loco de felicidad.\n"
            "JUANITO\n"
            "Esta canción se llama Otra.\n"
            "Juanito se reúne con Cosquillitas.\n"
            "Cantan otra.\n"
            "Y YA\n"
        )
        encore_anchor = cv._sequence_source_anchor(
            encore, "p101-l001-l008"
        )
        self.assertIsNotNone(encore_anchor)
        finale = {
            "actor": "Public, Juanito, and Cosquillitas",
            "action": (
                "Public demands encore ('Otra!'); Juanito announces the "
                "song is titled Otra; Cosquillitas performs it."
            ),
            "result": (
                "Final image is Cosquillitas performing encores for a "
                "delirious crowd; screenplay ends mid-celebration."
            ),
        }
        self.assertTrue(cv._sequence_compound_range_matches(
            finale, "action", encore_anchor["excerpt"]
        ))
        self.assertTrue(cv._sequence_compound_range_matches(
            finale, "result", encore_anchor["excerpt"]
        ))
        without_announcement = encore.replace(
            "Esta canción se llama Otra.\n", ""
        )
        without_performance = encore.replace("Cantan otra.\n", "")
        self.assertFalse(cv._sequence_compound_range_matches(
            finale,
            "action",
            cv._sequence_source_anchor(
                without_announcement, "p101-l001-l007"
            )["excerpt"],
        ))
        self.assertFalse(cv._sequence_compound_range_matches(
            finale,
            "action",
            cv._sequence_source_anchor(
                without_performance, "p101-l001-l007"
            )["excerpt"],
        ))
        decoded_beat = {
            "order": 1,
            "phase": "final_scene",
            "page": 101,
            **finale,
            "character_knowledge": cv.SEQUENCE_KNOWLEDGE_NOT_APPLICABLE,
            "audience_knowledge": (
                "The audience hears the request and performance."
            ),
        }
        decoded_row = cv.build_detail_audit_rows({}, [], [decoded_beat])[0]
        decoded_slot = decoded_row["slot"]
        decoded, reason = cv._decode_grounded_detail_value(
            {
                "classification": "partially_supported",
                "checks": [
                    {
                        "field": "actor",
                        "source_id": (
                            f"{decoded_slot}:actor:p101-l001-l008"
                        ),
                        "supports": True,
                    },
                    *[
                        {
                            "field": field,
                            "source_id": (
                                f"{decoded_slot}:{field}:p101-l001-l008"
                            ),
                            "supports": True,
                        }
                        for field in ("action", "result")
                    ],
                    *[
                        {
                            "field": field,
                            "source_id": cv.SEQUENCE_SOURCE_NOT_LOCATED,
                            "supports": False,
                        }
                        for field in (
                            "character_knowledge", "audience_knowledge",
                        )
                    ],
                ],
                "note": "The literal finale range supports action and result.",
            },
            decoded_row,
            encore,
        )
        self.assertIsNone(reason)
        self.assertEqual(decoded["classification"], "partially_supported")
        self.assertTrue(all(
            check["supports"]
            for check in decoded["checks"]
            if check["field"] in {"action", "result"}
        ))
        row = {"slot": "sequence_001", "kind": "sequence_evidence"}
        actor_range, reason = cv._sequence_source_token_anchor(
            "sequence_001:actor:p001-l001-l002", row, "actor"
        )
        self.assertIsNone(reason)
        self.assertEqual(actor_range, "p001-l001-l002")
        actor_source = (
            "[PAGE 1]\nCarlos watches.\nDiego opens the vault.\n"
        )
        self.assertEqual(
            cv._sequence_actor_point_from_range(
                actor_source,
                actor_range,
                {"actor": "Diego"},
            ),
            "p001-l002",
        )
        self.assertIsNone(cv._sequence_actor_point_from_range(
            (
                "[PAGE 1]\nDiego leaves.\n"
                "INT. OTHER HOUSE - DAY\nCarlos returns.\n"
            ),
            "p001-l001-l003",
            {"actor": "Diego"},
        ))
        overlong = "[PAGE 1]\n" + "\n".join(
            f"Line {index} has enough source words." for index in range(25)
        )
        self.assertIsNone(cv._sequence_source_anchor(
            overlong, "p001-l001-l025"
        ))
        adjacent = (
            "[PAGE 1]\nTony starts the recorded confession.\n"
            "[PAGE 2]\nThe judges receive the gifts from Tony.\n"
        )
        self.assertIsNotNone(cv._sequence_source_anchor(
            adjacent, "p001-l001-p002-l001"
        ))
        crossing_scene = adjacent.replace(
            "[PAGE 2]\n", "[PAGE 2]\nINT. OTHER ROOM - DAY\n"
        )
        self.assertIsNone(cv._sequence_source_anchor(
            crossing_scene, "p001-l001-p002-l002"
        ))

    def test_supported_event_inventory_rejects_rewrite_and_permutation(self):
        source, plan = self._event_bundle_fixture()
        for item in plan:
            item["reasons"] = ["same-page source order inversion"]

        def repair(values):
            return {
                "repairs": [
                    {"slot": item["slot"], "corrected_value": values[index]}
                    for index, item in enumerate(plan)
                ]
            }

        first = source["sequence_ledger"][0]
        second = source["sequence_ledger"][1]
        for values in (
            [
                second["action"], second["result"],
                first["action"], first["result"],
            ],
            [
                "Diego drops the trophy.", first["result"],
                second["action"], second["result"],
            ],
            [
                first["action"], first["result"],
                first["action"], first["result"],
            ],
        ):
            with self.subTest(values=values):
                with self.assertRaisesRegex(
                    cv.CoverageContractError, "protected material event"
                ):
                    cv._apply_post_detail_sequence_repairs(
                        source, repair(values), plan
                    )

        literal_source, literal_plan = self._event_bundle_fixture()
        for item in literal_plan:
            item["reasons"] = ["same-page source order inversion"]
        literal_source["sequence_ledger"][0]["action"] = "Diego dice sí."
        literal_plan[0]["prior_value"] = "Diego dice sí."
        literal_values = [
            literal_source["sequence_ledger"][0]["action"],
            literal_source["sequence_ledger"][0]["result"],
            literal_source["sequence_ledger"][1]["action"],
            literal_source["sequence_ledger"][1]["result"],
        ]
        for mutation in ("Diego dice si.", "diego dice sí.", "Diego dice sí"):
            with self.subTest(literal_mutation=mutation):
                changed = list(literal_values)
                changed[0] = mutation
                with self.assertRaisesRegex(
                    cv.CoverageContractError, "protected material event"
                ):
                    cv._apply_post_detail_sequence_repairs(
                        literal_source, repair(changed), literal_plan
                    )

    def test_ungrounded_event_pair_cannot_be_rewritten(self):
        source, plan = self._event_bundle_fixture()
        with self.assertRaisesRegex(
            cv.CoverageContractError, "protected material event"
        ):
            cv._apply_post_detail_sequence_repairs(
                source,
                {"repairs": [
                    {
                        "slot": item["slot"],
                        "corrected_value": (
                            "Diego returns the trophy."
                            if item["ledger_index"] == 0
                            and item["field"] == "action"
                            else "The trophy returns to its owner."
                            if item["ledger_index"] == 0
                            else "Roman congratulates Diego."
                            if item["field"] == "action"
                            else "The rivals reconcile."
                        ),
                    }
                    for item in plan
                ]},
                plan,
            )

    def test_repaired_event_source_order_and_checkpoint_are_bound(self):
        source, plan = self._event_bundle_fixture()
        for item in plan:
            item["reasons"] = ["same-page source order inversion"]
        repair = {
            "repairs": [
                {
                    "slot": item["slot"],
                    "corrected_value": source["sequence_ledger"][
                        item["ledger_index"]
                    ][item["field"]],
                }
                for item in plan
            ]
        }
        candidate, changed_paths = cv._apply_post_detail_sequence_repairs(
            source, repair, plan
        )
        candidate["sequence_evidence"] = [
            {
                "field_path": f"sequence_ledger[{order}]",
                "checks": [{
                    "field": "action",
                    "source_anchor_id": f"p006-l{line:03d}",
                }],
            }
            for order, line in ((1, 1), (2, 2))
        ]
        self.assertTrue(cv._sequence_repair_source_order_is_literal(candidate))
        candidate["sequence_evidence"][1]["checks"][0][
            "source_anchor_id"
        ] = "p006-l000"
        self.assertFalse(cv._sequence_repair_source_order_is_literal(candidate))
        candidate["sequence_evidence"][1]["checks"][0][
            "source_anchor_id"
        ] = "p006-l002"

        candidate["sequence_evidence"][1]["checks"][0][
            "source_anchor_id"
        ] = "p006-l001"
        self.assertFalse(cv._sequence_repair_source_order_is_literal(candidate))
        candidate["sequence_evidence"][1]["checks"][0][
            "source_anchor_id"
        ] = "p006-l001-l002"
        self.assertFalse(cv._sequence_repair_source_order_is_literal(candidate))
        candidate["sequence_evidence"][1]["checks"][0][
            "source_anchor_id"
        ] = "p006-l002"

        candidate["sequence_ledger"][0]["phase"] = "ending"
        candidate["sequence_ledger"][1]["phase"] = "final_scene"
        candidate["sequence_evidence"][0]["checks"][0][
            "source_anchor_id"
        ] = "p006-l010"
        candidate["sequence_evidence"][1]["checks"][0][
            "source_anchor_id"
        ] = "p006-l005"
        self.assertFalse(cv._sequence_repair_source_order_is_literal(candidate))
        candidate["sequence_ledger"][1]["phase"] = "ending"
        candidate["sequence_evidence"][0]["checks"][0][
            "source_anchor_id"
        ] = "p006-l001"
        candidate["sequence_evidence"][1]["checks"][0][
            "source_anchor_id"
        ] = "p006-l002"

        source_sha = cv.canonical_json_hash(source)
        inventory_sha = cv.canonical_json_hash(
            cv._sequence_protected_event_inventory(source, plan)
        )
        record = {
            "sequence_repair_contract_version": (
                cv.SEQUENCE_REPAIR_CONTRACT_VERSION
            ),
            "source_audit_sha256": source_sha,
            "material_event_inventory_sha256": inventory_sha,
            "plan": plan,
            "plan_sha256": cv.canonical_json_hash(plan),
            "audit": candidate,
            "audit_sha256": cv.canonical_json_hash(candidate),
            "corrected_ledger_sha256": cv.canonical_json_hash(
                candidate["sequence_ledger"]
            ),
            "changed_paths": changed_paths,
            "authorized_not_applicable_orders": [],
            "details_verified": False,
        }
        self.assertIsNotNone(cv._validated_sequence_repair_checkpoint(
            record, source_sha, inventory_sha, plan, final=False
        ))
        tampered = copy.deepcopy(record)
        tampered["audit"]["sequence_ledger"][0]["action"] = (
            "Diego hides the trophy."
        )
        tampered["audit_sha256"] = cv.canonical_json_hash(tampered["audit"])
        tampered["corrected_ledger_sha256"] = cv.canonical_json_hash(
            tampered["audit"]["sequence_ledger"]
        )
        with self.assertRaises(cv.CheckpointTamperedError):
            cv._validated_sequence_repair_checkpoint(
                tampered, source_sha, inventory_sha, plan, final=False
            )

    def test_plan_targets_every_pair_in_a_same_page_source_inversion(self):
        source, _plan = self._event_bundle_fixture()
        third = copy.deepcopy(source["sequence_ledger"][1])
        third.update({
            "order": 3,
            "actor": "Lucesita",
            "action": "Lucesita enters the field.",
            "result": "Lucesita joins the celebration.",
            "character_knowledge": "Lucesita knows Diego won.",
            "audience_knowledge": "The crowd sees Lucesita arrive.",
        })
        source["sequence_ledger"].append(third)
        source["sequence_evidence"] = [
            {
                "field_path": f"sequence_ledger[{order}]",
                "classification": "supported",
                "grounding_valid": True,
                "claim_sha256": f"claim-{order}",
                "row_identity": f"row-{order}",
                "checks": [{
                    "field": "action",
                    "supports": True,
                    "source_anchor_id": f"p006-l{line:03d}",
                }],
            }
            for order, line in ((1, 20), (2, 30), (3, 10))
        ]

        plan, blockers = cv._post_detail_sequence_repair_plan(source)

        self.assertFalse(plan)
        self.assertTrue(blockers)
        self.assertTrue(all(
            "requires a new atomic audit" in blocker
            for blocker in blockers
        ))

    def test_source_order_blocker_cannot_seal_public_report(self):
        coverage = valid_coverage()
        core = provider_audit_core(coverage)
        second = copy.deepcopy(core["sequence_ledger"]["climax"][0])
        second["result"] = "Diego detiene el último penal."
        core["sequence_ledger"]["climax"].append(second)
        action = (
            "Diego detiene el último penal de la final y se desploma sobre "
            "el pasto."
        )
        audience = "El público ve que Diego detiene el último penal."
        source = SCREENPLAY_TEXT.replace(
            action, f"{action}\n{audience}\n{action}", 1
        )
        page_map = cv.build_page_reference_map(source, 6, None)
        normalized = cv.normalize_audit_tool_input(
            copy.deepcopy(core), page_map["valid_citation_pages"]
        )
        evidence = cv.build_existing_evidence_checks(coverage, source)
        rows = cv.build_detail_audit_rows(
            coverage, evidence, normalized["sequence_ledger"]
        )
        detail = detail_payload_for_rows(rows, source)
        second_row = next(
            row for row in rows
            if row["kind"] == "sequence_evidence"
            and row["subject"]["beat"]["order"] == 2
        )
        slot = second_row["slot"]
        second_detail = json.loads(detail["results"][slot])
        for check in second_detail["checks"]:
            field = check["field"]
            if field in {"action", "result"}:
                check["source_id"] = f"{slot}:{field}:p006-l003w01"
            elif field == "audience_knowledge":
                check["source_id"] = (
                    f"{slot}:audience_knowledge:p006-l004"
                )
        detail["results"][slot] = json.dumps(second_detail)
        transport = FakeTransport([
            (coverage, settled_usage()),
            (core, settled_usage()),
            (detail, settled_usage()),
        ])

        report, _usage = run_engine(
            new_store(), transport, text=source,
            max_calls=3, max_cost_usd=5.0,
        )

        self.assertEqual(report["status"], "needs_review")
        self.assertEqual(
            [call["stage"] for call in transport.calls],
            [
                "coverage_v1.coverage",
                "coverage_v1.fact_audit",
                "coverage_v1.fact_audit_details",
            ],
        )
        blockers = report["diagnostics"]["sequence_repair"]["blockers"]
        self.assertTrue(any(
            "sequence source order inversion" in blocker
            for blocker in blockers
        ))
        self.assertTrue(any(
            "sequence correction requires human review" in reason
            for reason in report["review_reasons"]
        ))

    def test_provider_duplicate_material_beat_is_rejected(self):
        coverage = valid_coverage()
        audit = supported_audit(coverage)
        duplicate = copy.deepcopy(audit["sequence_ledger"][0])
        audit["sequence_ledger"].insert(1, duplicate)
        for order, beat in enumerate(audit["sequence_ledger"], 1):
            beat["order"] = order
        audit["sequence_evidence"] = [
            {
                "field_path": f"sequence_ledger[{beat['order']}]",
                "classification": "supported",
                "note": "The source grounds every required field.",
                "checks": [],
                "claim_sha256": cv.canonical_json_hash({
                    field: beat.get(field)
                    for field in (
                        "order", "phase", "page",
                        *cv.GROUNDED_SEQUENCE_FIELDS,
                    )
                }),
                "grounding_valid": True,
            }
            for beat in audit["sequence_ledger"]
            if beat["action"] != "NOT PRESENT"
        ]

        problems = cv.validate_audit_payload(
            audit,
            cv.build_audit_claims(coverage),
            coverage,
            cv.build_page_reference_map(SCREENPLAY_TEXT, 6, None),
            cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT),
        )

        self.assertTrue(any(
            "duplicates a material beat" in problem for problem in problems
        ))

    def test_provider_paraphrase_cannot_reuse_overlapping_action_source(self):
        coverage = valid_coverage()
        for phase, page in (
            ("climax", 6),
            ("final_scene", 6),
            ("ending", 5),
        ):
            with self.subTest(phase=phase, page=page):
                audit = supported_audit(coverage)
                duplicate = copy.deepcopy(audit["sequence_ledger"][0])
                duplicate.update({
                    "phase": phase,
                    "page": page,
                    "action": duplicate["action"] + "!",
                    "result": duplicate["result"] + "!",
                })
                audit["sequence_ledger"].insert(1, duplicate)
                for order, beat in enumerate(audit["sequence_ledger"], 1):
                    beat["order"] = order
                audit["sequence_evidence"] = [
                    {
                        "field_path": f"sequence_ledger[{beat['order']}]",
                        "classification": "supported",
                        "note": "The source grounds every required field.",
                        "checks": ([{
                            "field": "action",
                            "supports": True,
                            "source_anchor_id": (
                                "p006-l003w01" if beat["order"] == 1
                                else "p006-l002-l003"
                            ),
                        }] if beat["order"] in {1, 2} else []),
                        "claim_sha256": cv.canonical_json_hash({
                            field: beat.get(field)
                            for field in (
                                "order", "phase", "page",
                                *cv.GROUNDED_SEQUENCE_FIELDS,
                            )
                        }),
                        "grounding_valid": True,
                    }
                    for beat in audit["sequence_ledger"]
                    if beat["action"] != "NOT PRESENT"
                ]

                problems = cv.validate_audit_payload(
                    audit,
                    cv.build_audit_claims(coverage),
                    coverage,
                    cv.build_page_reference_map(SCREENPLAY_TEXT, 6, None),
                    cv.build_existing_evidence_checks(
                        coverage, SCREENPLAY_TEXT
                    ),
                )

                self.assertTrue(any(
                    "overlaps an action source span" in problem
                    for problem in problems
                ))

    def test_apply_rejects_incomplete_duplicate_and_untyped_slots(self):
        _coverage, _core, _detail, plan, repair, _pending = (
            self._repair_fixture()
        )
        source = supported_audit(valid_coverage())
        failed = copy.deepcopy(source)
        failed_row = failed["sequence_evidence"][0]
        failed_row.update({
            "classification": "unsupported",
            "grounding_valid": True,
            "checks": [{"field": "actor", "supports": False}],
        })
        simple_plan, blockers = cv._post_detail_sequence_repair_plan(failed)
        self.assertFalse(blockers)
        valid = {
            "repairs": [{
                "slot": simple_plan[0]["slot"],
                "corrected_value": "Diego Salas",
            }]
        }
        for malformed in (
            {"repairs": []},
            {"repairs": [*valid["repairs"], *valid["repairs"]]},
            {"repairs": [{
                "slot": simple_plan[0]["slot"],
                "corrected_value": 7,
            }]},
        ):
            with self.subTest(malformed=malformed):
                with self.assertRaises(cv.CoverageContractError):
                    cv._apply_post_detail_sequence_repairs(
                        failed, malformed, simple_plan
                    )
        unchanged, paths = cv._apply_post_detail_sequence_repairs(
            failed,
            {"repairs": [{
                "slot": simple_plan[0]["slot"],
                "corrected_value": source["sequence_ledger"][0]["actor"],
            }]},
            simple_plan,
        )
        self.assertEqual(
            unchanged["sequence_ledger"][0]["actor"],
            source["sequence_ledger"][0]["actor"],
        )
        self.assertEqual(paths, [simple_plan[0]["field_path"]])
        self.assertTrue(plan)
        self.assertTrue(repair["repairs"])

    def test_checkpointed_repair_resumes_without_rebuying_call_13(self):
        coverage, core, first_detail, _plan, repair, pending = (
            self._repair_fixture()
        )
        store = new_store()
        first = FakeTransport([
            (coverage, settled_usage()),
            (core, settled_usage()),
            (first_detail, settled_usage()),
            (repair, settled_usage()),
        ])

        partial, _usage = run_engine(
            store, first, max_calls=4, max_cost_usd=5.0
        )

        self.assertEqual(partial["status"], "needs_review")
        self.assertEqual(
            first.calls[-1]["stage"], "coverage_v1.sequence_repair"
        )
        self.assertEqual(
            partial["diagnostics"]["sequence_repair"]["deferred_stage"],
            "coverage_v1.sequence_repair_details",
        )

        resume = FakeTransport([
            (typed_detail_payload_for_rows(pending), settled_usage())
        ])
        report, _usage = run_engine(
            store, resume, max_calls=5, max_cost_usd=5.0
        )

        self.assertEqual(
            [call["stage"] for call in resume.calls],
            ["coverage_v1.sequence_repair_details"],
        )
        self.assertTrue(report["diagnostics"]["sequence_repair"]["applied"])
        self.assertEqual(report["status"], "sealed")

    def test_malformed_redetail_stops_before_fact_repair(self):
        coverage, core, first_detail, _plan, repair, _pending = (
            self._repair_fixture()
        )
        store = new_store()
        run_engine(
            store,
            FakeTransport([
                (coverage, settled_usage()),
                (core, settled_usage()),
                (first_detail, settled_usage()),
                (repair, settled_usage()),
            ]),
            max_calls=4,
            max_cost_usd=5.0,
        )
        resume = FakeTransport([
            ({"sequence_results": []}, settled_usage()),
            (coverage, settled_usage()),
        ])

        with self.assertRaises(cv.CoverageContractError):
            run_engine(
                store, resume, max_calls=6, max_cost_usd=5.0
            )

        self.assertEqual(len(resume.calls), 1)
        self.assertEqual(
            resume.calls[0]["stage"],
            "coverage_v1.sequence_repair_details",
        )


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
