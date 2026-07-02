"""Tests for the Story Grid genre engine. Run: python3 execution/test_story_grid.py"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from story_grid import (  # noqa: E402
    EXTERNAL_GENRES,
    COMEDY_SUBGENRES,
    build_genre_card,
    build_genre_detection_prompt,
    canonical_external,
    parse_detection,
)


class TestDataIntegrity(unittest.TestCase):
    def test_eleven_external_genres(self):
        self.assertEqual(len(EXTERNAL_GENRES), 11)
        for name in ["Action", "Horror", "Comedy", "Crime", "Thriller", "Western",
                     "Eastern", "War", "Society", "Love", "Performance"]:
            self.assertIn(name, EXTERNAL_GENRES)

    def test_every_genre_has_required_fields(self):
        for name, g in EXTERNAL_GENRES.items():
            self.assertTrue(g.get("value_spectrum"), f"{name} missing value_spectrum")
            self.assertTrue(g.get("core_event"), f"{name} missing core_event")
            self.assertGreaterEqual(len(g.get("obligatory_scenes", [])), 4, f"{name} too few obligatory scenes")
            for s in g["obligatory_scenes"]:
                self.assertIn("scene", s)
                self.assertIn("placement", s)

    def test_comedy_has_pairing_rule_and_craft_rules(self):
        c = EXTERNAL_GENRES["Comedy"]
        self.assertIn("pairing_rule", c)
        self.assertEqual(len(c["craft_rules"]), 5)
        self.assertEqual(len(COMEDY_SUBGENRES), 6)


class TestCanonicalization(unittest.TestCase):
    def test_exact_and_case(self):
        self.assertEqual(canonical_external("Horror"), "Horror")
        self.assertEqual(canonical_external("horror"), "Horror")
        self.assertEqual(canonical_external("  COMEDY "), "Comedy")

    def test_synonyms(self):
        self.assertEqual(canonical_external("romance"), "Love")
        self.assertEqual(canonical_external("sci-fi"), "Action")
        self.assertEqual(canonical_external("mystery"), "Crime")

    def test_unknown_is_none(self):
        self.assertIsNone(canonical_external("interpretive dance"))
        self.assertIsNone(canonical_external(None))


class TestParseDetection(unittest.TestCase):
    def test_comedy_defaults_pairing_when_missing(self):
        det = parse_detection({"external_genre": "Comedy", "is_comedy": True})
        self.assertTrue(det["is_comedy"])
        self.assertEqual(det["comedy_paired_genre"], "Love")  # default

    def test_comedy_keeps_valid_pairing(self):
        det = parse_detection({"external_genre": "Comedy", "is_comedy": True,
                               "comedy_paired_genre": "Action", "comedy_subgenre": "Buddy Comedy"})
        self.assertEqual(det["comedy_paired_genre"], "Action")
        self.assertEqual(det["comedy_subgenre"], "Buddy Comedy")

    def test_primary_comedy_forces_is_comedy(self):
        det = parse_detection({"external_genre": "comedy"})
        self.assertTrue(det["is_comedy"])

    def test_dramatic_with_comedic_tone(self):
        det = parse_detection({"external_genre": "Crime", "comedic_tone": True})
        self.assertFalse(det["is_comedy"])
        self.assertTrue(det["comedic_tone"])
        self.assertIsNone(det["comedy_paired_genre"])

    def test_unknown_genre_falls_back_to_society(self):
        det = parse_detection({"external_genre": "avant-garde nonsense"})
        self.assertEqual(det["external_genre"], "Society")

    def test_invalid_subgenre_dropped(self):
        det = parse_detection({"external_genre": "Comedy", "is_comedy": True,
                               "comedy_subgenre": "Not A Subgenre"})
        self.assertIsNone(det["comedy_subgenre"])


class TestGenreCard(unittest.TestCase):
    def test_horror_card_lists_obligatory_scenes(self):
        card = build_genre_card({"external_genre": "Horror"})
        self.assertIn("Horror", card)
        self.assertIn("Victims Picked Off", card)
        self.assertIn("False Ending", card)
        self.assertIn("Core Event", card)

    def test_comedy_card_carries_both_spines(self):
        card = build_genre_card({
            "external_genre": "Comedy", "is_comedy": True,
            "comedy_paired_genre": "Love", "comedy_subgenre": "Rom-Com",
            "comedic_tone": True, "internal_genre": "Maturation",
        })
        # Comedy scenes
        self.assertIn("Comic Premise Established", card)
        self.assertIn("ACT 2 IS ESCALATION", card)
        # Subgenre scenes
        self.assertIn("The Meet-Cute", card)
        # Paired genre spine
        self.assertIn("PAIRED GENRE", card)
        self.assertIn("Proof of Love", card)
        # Internal arc
        self.assertIn("Maturation", card)

    def test_card_accepts_raw_detection(self):
        # build_genre_card should normalise a raw (unparsed) detection too
        card = build_genre_card({"external_genre": "comedy"})
        self.assertIn("Comedy", card)
        self.assertIn("PAIRED GENRE", card)  # defaulted to Love

    def test_dramatic_card_has_no_comedy_grading(self):
        card = build_genre_card({"external_genre": "Thriller"})
        self.assertIn("Race Against Time", card)
        self.assertNotIn("ACT 2 IS ESCALATION", card)


class TestDetectionPrompt(unittest.TestCase):
    def test_prompt_lists_all_genres_and_returns_json_shape(self):
        p = build_genre_detection_prompt()
        for g in ["Action", "Horror", "Comedy"]:
            self.assertIn(g, p)
        self.assertIn("external_genre", p)
        self.assertIn("comedy_paired_genre", p)
        self.assertIn("Return ONLY valid JSON", p)


if __name__ == "__main__":
    unittest.main(verbosity=2)
