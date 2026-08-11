import copy
import unittest

from execution.development_opportunity import derive_development_opportunity


def metric(score, detail, pages):
    return {
        "score": score,
        "justification": detail,
        "page_citations": pages,
    }


class DevelopmentOpportunityGateTests(unittest.TestCase):
    def test_will_routes_despite_61_concept_pillar_without_rescoring(self):
        analysis = {
            "weighted_score": 5.2,
            "weighted_score_adjusted": 4.7,
            "verdict": "PASS",
            "pillar_scores": {
                "structure": {"score": 4.8},
                "character": {"score": 4.4},
                "craft_scene": {"score": 5.0},
                "concept": {"score": 6.1},
                "emotional_resonance": {"score": 6.0},
            },
            "weaknesses": [
                "Will remains passive until the final act.",
                "The inciting incident arrives late.",
            ],
        }
        reports = {
            "concept": {
                "pillar_score": 6.1,
                "sub_scores": {
                    "hook_clarity": metric(8.6, "A genuinely pitchable high-concept hook.", [1, 4]),
                    "narrative_engine": metric(8.1, "The life-writer device keeps generating comic conflict.", [12, 27]),
                    "freshness": metric(7.7, "A fresh metaphysical romantic-comedy engine.", [1, 32]),
                },
            }
        }
        original = copy.deepcopy(analysis)

        result = derive_development_opportunity(analysis, reports)

        self.assertTrue(result["requires_producer_look"])
        self.assertEqual(result["level"], "producer_review")
        self.assertEqual(result["fixability"], "high")
        self.assertEqual(result["strongest_signal"], "high_concept")
        self.assertEqual(result["evidence"][0]["page_citations"], [1, 4])
        self.assertEqual(analysis, original)
        self.assertEqual(analysis["weighted_score_adjusted"], 4.7)
        self.assertEqual(analysis["verdict"], "PASS")

    def test_single_shiny_hook_with_broken_execution_does_not_route(self):
        analysis = {
            "weighted_score_adjusted": 3.0,
            "verdict": "PASS",
            "pillar_scores": {
                "structure": {"score": 2.5},
                "character": {"score": 2.8},
                "craft_scene": {"score": 3.1},
                "concept": {"score": 5.0},
            },
        }
        reports = {
            "concept": {
                "sub_scores": {
                    "hook_clarity": metric(8.2, "A catchy sentence.", [1]),
                    "narrative_engine": metric(4.0, "No sustained engine.", [20]),
                    "freshness": metric(4.2, "Derivative execution.", [30]),
                }
            }
        }

        result = derive_development_opportunity(analysis, reports)

        self.assertFalse(result["requires_producer_look"])
        self.assertEqual(result["fixability"], "low")


if __name__ == "__main__":
    unittest.main()
