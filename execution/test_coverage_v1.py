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
            "tone": "warm, redemptive",
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
        "commercial_hypothesis": (
            "Familias mexicanas y público de fútbol; comps Rudo y Cursi, "
            "McFarland USA; drama deportivo familiar de barrio para estreno "
            "teatral local"
        ),
    }


def supported_audit(coverage: dict) -> dict:
    claims = cv.build_audit_claims(coverage)
    return {
        "verdicts": [
            {
                "claim_id": claim["claim_id"],
                "classification": "supported",
                "note": "Confirmado en el texto.",
            }
            for claim in claims
        ]
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

    def test_single_wrong_leading_word_verifies_when_long_enough(self):
        # Canary near-miss pattern 2 (the Slasher failure): the model
        # normalizes one leading word ("El COQUERO" for "del...COQUERO");
        # the remaining quote is long and verbatim.
        coverage = valid_coverage()
        coverage["strengths"][1]["excerpt"] = (
            "Un médico le dice a Diego que su corazón no soporta"
        )
        summary = cv.verify_citations(coverage, SCREENPLAY_TEXT)
        self.assertEqual(summary["unverified"], 0)
        item = coverage["strengths"][1]
        self.assertTrue(item["citation_verified"])
        self.assertIn("lead_word_dropped", item["citation_match_kind"])

    def test_lead_word_drop_never_rescues_short_excerpts(self):
        # Dropping the leading word requires >= 5 remaining verbatim words,
        # so short partly-wrong quotes stay flagged.
        coverage = valid_coverage()
        coverage["strengths"][1]["excerpt"] = "mal corazón no soporta"
        summary = cv.verify_citations(coverage, SCREENPLAY_TEXT)
        self.assertEqual(summary["unverified"], 1)
        self.assertFalse(coverage["strengths"][1]["citation_verified"])

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

    def test_incomplete_audit_twice_fails_closed(self):
        coverage = valid_coverage()
        bad_audit = supported_audit(coverage)
        bad_audit["verdicts"].pop()
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (bad_audit, settled_usage()),
                (bad_audit, settled_usage()),
            ]
        )
        with self.assertRaises(cv.CoverageContractError):
            run_engine(new_store(), transport)
        self.assertEqual(len(transport.calls), 3)

    def test_no_audit_retry_when_repair_slot_already_spent(self):
        broken = valid_coverage()
        del broken["development_priorities"]
        fixed = valid_coverage()
        bad_audit = supported_audit(fixed)
        bad_audit["verdicts"].pop()
        transport = FakeTransport(
            [
                (broken, settled_usage()),
                (fixed, settled_usage()),
                (bad_audit, settled_usage()),
            ]
        )
        with self.assertRaises(cv.CoverageContractError):
            run_engine(new_store(), transport)
        # coverage + coverage repair + audit = 3 calls; no fourth.
        self.assertEqual(len(transport.calls), 3)

    def test_partially_supported_central_fact_recommends_review(self):
        coverage = valid_coverage()
        audit = supported_audit(coverage)
        audit["verdicts"][0]["classification"] = "partially_supported"
        transport = FakeTransport(
            [
                (coverage, settled_usage()),
                (audit, settled_usage()),
            ]
        )
        report, _usage = run_engine(new_store(), transport)
        self.assertEqual(report["status"], "sealed")
        self.assertTrue(report["human_review_recommended"])


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


if __name__ == "__main__":
    unittest.main(verbosity=1)
