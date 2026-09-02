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
    return {
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
                "actor": "Diego and the children",
                "action": coverage["story_spine"]["ending"],
                "result": "The ending begins after the decisive action.",
                "character_knowledge": "The characters know the result.",
                "audience_knowledge": "The audience sees the new state.",
                "page": last_page,
            },
            {
                "order": 3,
                "phase": "final_scene",
                "actor": "Diego and the children",
                "action": coverage["story_spine"]["ending"],
                "result": "The story reaches its literal final state.",
                "character_knowledge": "The characters know the result.",
                "audience_knowledge": "The audience sees the aftermath.",
                "page": last_page,
            },
            {
                "order": 4,
                "phase": "tag",
                "actor": "N/A",
                "action": "NOT PRESENT",
                "result": "No separate tag follows the final scene.",
                "character_knowledge": "N/A",
                "audience_knowledge": "No additional information is revealed.",
                "page": last_page,
            },
            {
                "order": 5,
                "phase": "aftermath",
                "actor": "Diego and the children",
                "action": coverage["story_spine"]["ending"],
                "result": "The consequences are shown in the final scene.",
                "character_knowledge": "The characters know the result.",
                "audience_knowledge": "The audience sees the consequences.",
                "page": last_page,
            },
        ],
        "citation_relevance": [
            {
                "owner": owner,
                "classification": "supported",
                "note": "The excerpt directly supports its attached claim.",
            }
            for owner, _item in cv._iter_citations(coverage)
        ],
    }


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


def supported_detail_payload(coverage: dict) -> dict:
    evidence = cv.build_existing_evidence_checks(coverage, SCREENPLAY_TEXT)
    return {
        "results": {
            row["slot"]: "supported: Confirmed against the screenplay."
            for row in cv.build_detail_audit_rows(coverage, evidence)
        }
    }


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
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (supported_audit(coverage), settled_usage()),
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
                    self.assertEqual(count_check["claimed_universe_total"], 0)

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
        self.assertEqual(exact["claimed_universe_total"], 0)
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
            [(2, 4), (5, 0)],
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
                (4, 0, "judges", "Four judges"),
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
                "claimed_total": row["subject"]["claimed_total"],
                "observed_total": 4 if index == 0 else 2,
                "claimed_universe_total": (
                    row["subject"]["claimed_universe_total"]
                ),
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
                "claimed_total": 2,
                "observed_total": 2,
                "claimed_universe_total": 0,
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

    def test_count_parser_ignores_measurements_and_rubric_numbers(self):
        examples = (
            ("That is seven distinct laugh moments across 89 pages.", [7]),
            ("The montage covers nine list items in three pages.", [9]),
            ("(5) Resolution closes the Story Grid analysis.", []),
            ("A three-page escalating sequence ends in a physical reveal.", []),
            ("Resolution: The six-month jump settles the ending.", []),
            ("Act 3 contains the payoff.", []),
            ("A ten-page laugh-free stretch follows.", []),
            ("The pig costume and the two-coffees ritual are callbacks.", []),
            ("He scores 10. The third judge gives a five.", []),
            ("Both simultaneously. Diego kills the attacker.", []),
            ("One scream. Comic runners return later.", []),
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
        self.assertEqual(
            cv._material_count_claimed_total("The ritual repeats two times."),
            2,
        )

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
        self.assertIn("subject.claimed_total", detail_text)
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
        rows = cv.build_detail_audit_rows(coverage, evidence)
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

    def test_detail_audit_uses_the_effective_retry_model(self):
        coverage = valid_coverage()
        bad_core = provider_audit_core(coverage)
        bad_core["sequence_ledger"]["ending"][0]["page"] = 5
        bad_core["sequence_ledger"]["climax"][0]["page"] = 6
        good_core = provider_audit_core(coverage)
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (bad_core, settled_usage()),
                (good_core, settled_usage()),
                (supported_detail_payload(coverage), settled_usage()),
            ]
        )

        report, _usage = run_engine(new_store(), transport)

        self.assertEqual(report["status"], "sealed")
        self.assertEqual(transport.calls[2]["model_key"], "sonnet")
        self.assertEqual(transport.calls[3]["model_key"], "sonnet")

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
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (audit, settled_usage()),
                (supported_detail_payload(coverage), settled_usage()),
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

    def test_cosquillitas_internal_ending_reversal_stops_before_details(self):
        coverage = valid_coverage()
        bad_audit = provider_audit_core(coverage)
        trophy = bad_audit["sequence_ledger"]["ending"][0]
        trophy["page"] = 6
        richie = copy.deepcopy(trophy)
        richie["page"] = 5
        richie["action"] = "Richie receives the wig before the exposé."
        bad_audit["sequence_ledger"]["ending"].append(richie)
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (bad_audit, settled_usage()),
                (bad_audit, settled_usage()),
            ]
        )

        with self.assertRaisesRegex(
            cv.CoverageContractError,
            "ending bucket pages must be nondecreasing",
        ):
            run_engine(new_store(), transport)

        self.assertEqual(
            [call["stage"] for call in transport.calls],
            [
                "coverage_v1.coverage",
                "coverage_v1.fact_audit",
                "coverage_v1.fact_audit",
            ],
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

    def test_invalid_phase_boundaries_and_markers_fail_normalization(self):
        coverage = valid_coverage()
        cases = []

        early_ending = provider_audit_core(coverage)
        first_climax = early_ending["sequence_ledger"]["climax"][0]
        first_climax["page"] = 4
        final_climax = copy.deepcopy(first_climax)
        final_climax["page"] = 6
        early_ending["sequence_ledger"]["climax"].append(final_climax)
        early_ending["sequence_ledger"]["ending"][0]["page"] = 5
        cases.append((early_ending, "ending begins before the final climax"))

        mixed_tag = provider_audit_core(coverage)
        extra_tag = copy.deepcopy(mixed_tag["sequence_ledger"]["tag"][0])
        extra_tag["action"] = "A real tag beat."
        mixed_tag["sequence_ledger"]["tag"].append(extra_tag)
        cases.append((mixed_tag, "tag has an invalid NOT PRESENT marker"))

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
        [key_dir] = list(store.root.iterdir())
        target = key_dir / "audit.json"
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
        [key_dir] = list(store.root.iterdir())
        target = key_dir / "coverage.json"
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
                    "claimed_total": 3,
                    "observed_total": 0,
                    "claimed_universe_total": 0,
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
                        "claimed_total": row["subject"]["claimed_total"],
                        "observed_total": 0,
                        "claimed_universe_total": 0,
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
                    "claimed_total": 3,
                    "observed_total": 2,
                    "claimed_universe_total": 0,
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
            "claimed_total": 3,
            "observed_total": 3,
            "claimed_universe_total": 0,
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
            "claimed_total": 2,
            "observed_total": 2,
            "claimed_universe_total": 0,
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
            "claimed_total": 2,
            "observed_total": 2,
            "claimed_universe_total": 0,
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
                "claimed_total": 2,
                "observed_total": 2,
                "claimed_universe_total": 0,
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
                    "claimed_total": 1,
                    "observed_total": 1,
                    "claimed_universe_total": 0,
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
            "claimed_total": 2,
            "observed_total": 2,
            "claimed_universe_total": 3,
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
            "claimed_total": 2,
            "observed_total": 3,
            "claimed_universe_total": 4,
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
        audit = supported_audit(coverage)
        for row in audit["verdicts"]:
            if row["claim_id"] == "guard.cross_field_consistency":
                row["classification"] = "partially_supported"
                row["note"] = "The report reverses Angela's decisive action."

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

    def test_no_audit_retry_when_repair_slot_already_spent(self):
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
            ]
        )
        # coverage + coverage repair + audit = 3 calls, no retry; the
        # missing non-central verdict is preserved as unclassified for review.
        report, _usage = run_engine(new_store(), transport)
        self.assertEqual(len(transport.calls), 3)
        self.assertEqual(report["status"], "needs_review")
        self.assertTrue(report["human_review_recommended"])

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
        audit = supported_audit(coverage)
        audit["verdicts"][0]["classification"] = "partially_supported"
        audit["verdicts"][0]["note"] = "The fame claim is overstated."
        corrected = copy.deepcopy(coverage)
        corrected["story_spine"]["protagonist"] = (
            "Diego Salas, portero retirado de 58 años"
        )
        store = new_store()
        first = FakeTransport([
            (coverage, settled_usage()),
            (audit, settled_usage()),
            (corrected, settled_usage()),
            (provider_audit_core(corrected), settled_usage()),
            RuntimeError("proxy died during fact re-audit details"),
        ])

        with self.assertRaises(RuntimeError):
            run_engine(store, first)

        resume = FakeTransport([
            (supported_detail_payload(corrected), settled_usage()),
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


class TestBudget(unittest.TestCase):
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
        self.assertTrue(report["replay"]["coverage_replayed"])


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
