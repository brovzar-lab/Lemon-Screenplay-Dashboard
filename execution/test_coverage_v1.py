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
Diego detiene el último penal y se desploma sobre el pasto.
Los niños del barrio ganan el torneo y la cancha se salva.
Diego sobrevive y se queda como entrenador.
"""

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
                "result": "The decisive action completes.",
                "character_knowledge": "Diego understands the physical risk.",
                "audience_knowledge": "The audience knows the medical stakes.",
                "page": last_page,
            },
            {
                "order": 2,
                "phase": "ending",
                "actor": "Diego",
                "action": coverage["story_spine"]["ending"],
                "result": "The ending begins after the decisive action.",
                "character_knowledge": "Diego knows the result.",
                "audience_knowledge": "The audience sees the new state.",
                "page": last_page,
            },
            {
                "order": 3,
                "phase": "final_scene",
                "actor": "Diego",
                "action": coverage["story_spine"]["ending"],
                "result": "The story reaches its literal final state.",
                "character_knowledge": "Diego knows the result.",
                "audience_knowledge": "The audience sees the aftermath.",
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
                "action": coverage["story_spine"]["ending"],
                "result": "The consequences are shown in the final scene.",
                "character_knowledge": "Diego knows the result.",
                "audience_knowledge": "The audience sees the consequences.",
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


def grounded_detail_value(row: dict, text: str = SCREENPLAY_TEXT) -> str:
    subject = row["subject"]
    observed_actors: list[str] | None = None
    observed_knowers: list[str] | None = None
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
        observed_actors = [
            name for name in claimed_actors
            if cv._fold_evidence_text(name)
            in cv._fold_evidence_text(actor_excerpt)
        ]
        observed_knowers = [
            name for name in claimed_knowers
            if cv._fold_evidence_text(name)
            in cv._fold_evidence_text(knowledge_excerpt)
        ]
        checks = [
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
    value = {
        "classification": "supported",
        "checks": checks,
        "note": "The bound source excerpt supports this exact claim.",
    }
    if row["kind"] == "sequence_evidence":
        value["observed_actors"] = observed_actors
        value["observed_knowers"] = observed_knowers
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
        self.assertIn("verbatim 3-12-word excerpt", detail_text)
        self.assertIn("reveal provenance", detail_text)
        self.assertIn("capture/source", detail_text)
        self.assertIn("continuity_flags", detail_text)
        self.assertIn("code owns the claimed totals", detail_text.lower())
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
        result_schema = detail_tool["input_schema"]["properties"]["results"]
        slots = [row["slot"] for row in rows]
        self.assertEqual(result_schema["required"], slots)
        self.assertEqual(set(result_schema["properties"]), set(slots))
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
        result_schema = tool["input_schema"]["properties"]["results"]
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
        self.assertEqual(len(result_schema["required"]), 43)
        self.assertEqual(expanded["results"], values)
        self.assertLessEqual(
            cv.strict_schema_complexity(tool["input_schema"])[
                "property_count"
            ],
            cv.STRICT_BUDGET["property_count"],
        )

    def test_large_detail_repair_and_typed_retry_finish_within_seven_calls(self):
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
        self.assertEqual(report["status"], "sealed")
        self.assertEqual(report["cost"]["call_count"], 7)
        self.assertEqual(len(transport.calls), 7)

    def test_sequence_retry_is_bounded_and_details_stay_on_audit_model(self):
        coverage = valid_coverage()
        bad_core = provider_audit_core(coverage)
        climax = bad_core["sequence_ledger"]["climax"][0]
        climax["actor"] = "Two members"
        climax["action"] = (
            "Diego completes the decisive action on p.6 "
            "(as prepared, seen earlier on p.4)."
        )
        bad_core["sequence_ledger"]["final_scene"][0][
            "character_knowledge"
        ] = "Both members know the result."
        good_core = copy.deepcopy(bad_core)
        good_core["sequence_ledger"]["climax"][0]["actor"] = "Diego"
        good_core["sequence_ledger"]["final_scene"][0][
            "character_knowledge"
        ] = "Diego knows the result."
        good_core["verdicts"][0]["classification"] = "contradicted"
        normalized_good = cv.normalize_audit_tool_input(
            copy.deepcopy(good_core), range(1, 7)
        )
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (bad_core, settled_usage()),
                (good_core, settled_usage()),
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

    def test_targeted_sequence_retry_cannot_delete_a_rejected_beat(self):
        coverage = valid_coverage()
        bad_core = provider_audit_core(coverage)
        decisive = bad_core["sequence_ledger"]["climax"][0]
        earlier = copy.deepcopy(decisive)
        earlier["page"] = 5
        earlier["actor"] = "Two judges"
        earlier["action"] = "Diego confronts Román before the final."
        bad_core["sequence_ledger"]["climax"] = [earlier, decisive]
        deleted_beat_retry = provider_audit_core(coverage)
        transport = FakeTransport([
            (coverage, settled_usage()),
            (bad_core, settled_usage()),
            (deleted_beat_retry, settled_usage()),
        ])

        with self.assertRaisesRegex(
            cv.CoverageContractError, "changed the material beat count"
        ):
            run_engine(new_store(), transport, max_cost_usd=5.0)

        self.assertEqual(len(transport.calls), 3)

    def test_targeted_sequence_retry_cannot_substitute_the_wrong_actor(self):
        coverage = valid_coverage()
        bad_core = provider_audit_core(coverage)
        bad_core["sequence_ledger"]["climax"][0]["actor"] = "Two members"
        wrong_actor_retry = copy.deepcopy(bad_core)
        wrong_actor_retry["sequence_ledger"]["climax"][0]["actor"] = (
            "Román (seen on p.4)"
        )
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
        repaired = copy.deepcopy(candidate)
        repaired["sequence_ledger"][0]["actor"] = "The judges"

        merged = cv._merge_sequence_field_repairs(
            candidate,
            repaired,
            [
                "sequence_ledger[0].actor uses unverified numeric shorthand; "
                "name the actors or roles"
            ],
        )

        self.assertEqual(merged["sequence_ledger"][0]["actor"], "The judges")

        repaired["sequence_ledger"][0]["actor"] = "The judges with runners"
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

        repaired["sequence_ledger"][0]["actor"] = "DJ"
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

        repaired["sequence_ledger"][0]["actor"] = "N/A"
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
        repaired = copy.deepcopy(candidate)
        repaired["sequence_ledger"][0]["actor"] = "Carlo"

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
                repaired = copy.deepcopy(candidate)
                repaired["sequence_ledger"][0]["character_knowledge"] = claim
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
        richie["page"] = 5
        richie["action"] = "Richie chooses Lucesita before the result changes."
        expose = copy.deepcopy(richie)
        expose["page"] = 6
        expose["action"] = "The exposé overturns the corrupt result."
        audit["sequence_ledger"]["climax"].append(expose)
        normalized_audit = cv.normalize_audit_tool_input(
            copy.deepcopy(audit), range(1, 7)
        )
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (audit, settled_usage()),
                (
                    supported_detail_payload(coverage, normalized_audit),
                    settled_usage(),
                ),
            ]
        )

        report, _usage = run_engine(new_store(), transport)

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

    def test_cosquillitas_early_ending_is_reclassified_before_detail_audit(self):
        coverage = valid_coverage()
        audit = provider_audit_core(coverage)
        apparent_loss = audit["sequence_ledger"]["climax"][0]
        apparent_loss["page"] = 4
        apparent_loss["actor"] = "Román Vega"
        apparent_loss["character_knowledge"] = (
            "Román Vega knows he threatened the field."
        )
        apparent_loss["action"] = "The corrupt scores create an apparent loss."
        expose = copy.deepcopy(apparent_loss)
        expose["page"] = 6
        expose["actor"] = "Diego"
        expose["character_knowledge"] = "Diego knows the final result."
        expose["action"] = "The exposé overturns the corrupt result."
        audit["sequence_ledger"]["climax"].append(expose)
        richie = audit["sequence_ledger"]["ending"][0]
        richie["page"] = 5
        richie["actor"] = "Diego"
        richie["character_knowledge"] = "Diego knows the medical risk."
        richie["action"] = "Richie receives the wig before the exposé."
        coda = copy.deepcopy(richie)
        coda["page"] = 6
        coda["action"] = "The winners begin their post-climax celebration."
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
        prior_audit = completed_audit_fixture(coverage, normalized_audit)
        pending_detail = pending_reaudit_detail_payload(
            coverage,
            prior_audit,
            corrected,
            normalized_audit["sequence_ledger"],
        )
        transport = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (
                supported_detail_payload(coverage, normalized_audit),
                settled_usage(),
            ),
            (corrected, settled_usage()),
            (reaudited, settled_usage()),
            (pending_detail, settled_usage()),
        ])

        report, _usage = run_engine(new_store(), transport)

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
            "The exposé overturns the corrupt result.",
        )

    def test_fact_reaudit_preserves_reclassified_climax_beat(self):
        coverage = valid_coverage()
        audit = provider_audit_core(coverage)
        first = audit["sequence_ledger"]["climax"][0]
        first["page"] = 4
        first["actor"] = "Román Vega"
        first["character_knowledge"] = (
            "Román Vega knows he threatened the field."
        )
        first["action"] = "The corrupt scores create an apparent loss."
        expose = copy.deepcopy(first)
        expose["page"] = 6
        expose["actor"] = "Diego"
        expose["character_knowledge"] = "Diego knows the final result."
        expose["action"] = "The exposé overturns the corrupt result."
        audit["sequence_ledger"]["climax"].append(expose)
        richie = audit["sequence_ledger"]["ending"][0]
        richie["page"] = 5
        richie["actor"] = "Diego"
        richie["character_knowledge"] = "Diego knows the medical risk."
        richie["action"] = "Richie receives the wig before the exposé."
        audit["sequence_ledger"]["ending"].append(copy.deepcopy(expose))
        normalized_audit = cv.normalize_audit_tool_input(
            copy.deepcopy(audit), range(1, 7)
        )
        corrected = copy.deepcopy(coverage)
        corrected["story_spine"]["climax"] += "; Richie receives the wig"
        corrected["synopsis"] += " Richie receives the wig before the exposé."
        prior_audit = completed_audit_fixture(coverage, normalized_audit)
        pending_detail = pending_reaudit_detail_payload(
            coverage,
            prior_audit,
            corrected,
            normalized_audit["sequence_ledger"],
        )
        transport = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (
                supported_detail_payload(coverage, normalized_audit),
                settled_usage(),
            ),
            (corrected, settled_usage()),
            # The generic ledger omits the reclassified page-5 beat.
            (supported_audit(corrected), settled_usage()),
            (pending_detail, settled_usage()),
        ])

        report, _usage = run_engine(new_store(), transport)

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
        apparent_loss["page"] = 3
        expose = copy.deepcopy(apparent_loss)
        expose["page"] = 5
        expose["actor"] = "Diego"
        expose["character_knowledge"] = "Diego knows the medical risk."
        expose["action"] = "The exposé overturns the corrupt result."
        audit["sequence_ledger"]["climax"].append(expose)
        trophy = audit["sequence_ledger"]["ending"][0]
        trophy["page"] = 6
        trophy["action"] = "The trophy celebration completes the ending."
        richie = copy.deepcopy(trophy)
        richie["page"] = 4
        richie["actor"] = "Román Vega"
        richie["character_knowledge"] = (
            "Román Vega knows he threatened the field."
        )
        richie["action"] = "Richie receives the wig before the exposé."
        celebration = copy.deepcopy(trophy)
        celebration["page"] = 5
        celebration["actor"] = "Diego"
        celebration["character_knowledge"] = (
            "Diego knows the medical risk."
        )
        celebration["action"] = "The winners begin celebrating."
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
        transport = FakeTransport([
            (broken, settled_usage()),
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (
                supported_detail_payload(coverage, normalized_audit),
                settled_usage(),
            ),
            (corrected, settled_usage()),
            (provider_reaudit, settled_usage()),
            (pending_detail, settled_usage()),
        ])

        report, _usage = run_engine(new_store(), transport)

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
        record["payload"].pop("detail_contract_version")
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
            (provider_audit_core(coverage), settled_usage()),
            (supported_detail_payload(coverage), settled_usage()),
        ])

        with patch.object(
            cv, "DETAIL_AUDIT_CONTRACT_VERSION", "coverage-v1.2-detail-next"
        ):
            report, usage = run_engine(store, drift)

        self.assertEqual(
            [call["stage"] for call in drift.calls],
            ["coverage_v1.fact_audit", "coverage_v1.fact_audit_details"],
        )
        self.assertTrue(report["replay"]["coverage_replayed"])
        self.assertFalse(report["replay"]["audit_replayed"])
        self.assertEqual(usage["call_count"], 2)

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
            "submit_focused_detail_retry_v1_2",
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
            "submit_count_detail_retry_v1_2",
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
        self.assertIn("instance 1 excerpt is not on its page", retry_prompt)
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
            "submit_grounded_detail_retry_v1_2",
        )
        self.assertTrue(
            transport.calls[3]["stage"].endswith("_grounded_retry_1")
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
                    "submit_grounded_detail_retry_v1_2",
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
        )

    def test_observed_actor_name_requires_a_full_word_boundary(self):
        people, reason = cv._normalize_observed_people(
            ["Carlo"],
            field="observed_actors",
            excerpt="Carlos scores the decisive goal",
        )

        self.assertIsNone(people)
        self.assertIn("names are absent", str(reason))

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
                self.assertIn(expected, str(reason))

        named_source = (
            "[PAGE 1]\nCarlos scores the finalist and announces the result.\n"
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
        self.assertIn("actor roles are absent", str(reason))

        short_beat = {**base, "actor": "DJ"}
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
            "observed_knowers": ["The judges"],
            "note": "The source supports every field.",
        }

        decoded, reason = cv._decode_grounded_detail_value(
            value, target, source
        )

        self.assertIsNone(decoded)
        self.assertIn("omits a claimed actor", str(reason))

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
        self.assertIn("actor roles are absent", str(reason))

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
                    "character_knowledge": claim,
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
                                "Carlos scores the finalist and announces"
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
        self.assertIn("omits a claimed actor", str(reason))

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
        detail = supported_detail_payload(coverage)
        sequence_rows = [
            row for row in cv.build_detail_audit_rows(
                coverage,
                cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT),
                supported_audit(coverage)["sequence_ledger"],
            )
            if row["kind"] == "sequence_evidence"
        ]
        target = sequence_rows[0]
        value = json.loads(detail["results"][target["slot"]])
        value["classification"] = "contradicted"
        value["note"] = (
            "The action occurs, but the named character never learns it."
        )
        next(
            check for check in value["checks"]
            if check["field"] == "character_knowledge"
        )["supports"] = False
        detail["results"][target["slot"]] = json.dumps(value)
        transport = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (detail, settled_usage()),
        ])

        report, _usage = run_engine(new_store(), transport)

        self.assertEqual(report["status"], "needs_review")
        self.assertIn(
            "guard.sequence_integrity",
            report["fact_audit"]["central_failures"],
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
            resume.calls[0]["stage"].endswith("_grounded_retry_1")
        )

    def test_all_malformed_counts_retry_in_schema_safe_batches(self):
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

        retry_payloads = []
        for start in range(0, len(count_rows), cv.MAX_COUNT_DETAIL_RETRY_ROWS):
            retry_payloads.append({
                "results": {
                    row["slot"]: {
                        "classification": "unsupported",
                        "observed_total": 0,
                        "observed_universe_total": 0,
                        "instances": [],
                        "note": "No matching judges appear in the screenplay.",
                    }
                    for row in count_rows[
                        start:start + cv.MAX_COUNT_DETAIL_RETRY_ROWS
                    ]
                }
            })
        store = new_store()
        first = FakeTransport([
            (coverage, settled_usage()),
            (provider_audit_core(coverage), settled_usage()),
            (supported_detail_payload(coverage), settled_usage()),
            (retry_payloads[0], settled_usage()),
            RuntimeError("proxy died during count retry batch 2"),
        ])

        with self.assertRaises(RuntimeError):
            run_engine(store, first)

        self.assertEqual(
            [call["stage"] for call in first.calls[3:]],
            [
                "coverage_v1.fact_audit_details_count_retry_1",
                "coverage_v1.fact_audit_details_count_retry_2",
            ],
        )
        resume = FakeTransport([
            (retry_payloads[1], settled_usage()),
        ])
        report, usage = run_engine(store, resume)

        self.assertEqual(report["status"], "needs_review")
        self.assertEqual(len(resume.calls), 1)
        self.assertEqual(
            resume.calls[0]["stage"],
            "coverage_v1.fact_audit_details_count_retry_2",
        )
        self.assertEqual(usage["call_count"], 1)

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
            for index in range(1, cv.MAX_COUNT_DETAIL_RETRY_ROWS + 1)
        ]
        stats = cv.strict_schema_complexity(
            cv.build_count_detail_retry_tool(retry_rows)["input_schema"]
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
        audit["sequence_ledger"][0]["action"] = corrected_fact
        for row in audit["verdicts"]:
            if row["claim_id"] == "guard.cross_field_consistency":
                row["classification"] = "partially_supported"
                row["note"] = "The report reverses Angela's decisive action."
        audit = completed_audit_fixture(coverage, audit)
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
