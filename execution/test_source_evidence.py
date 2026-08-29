import copy
import unittest

from execution.source_evidence import (
    SourceEvidenceError,
    attach_verified_citation_quality,
    build_context_policy,
    build_page_evidence,
    extract_title_page_author,
    join_marked_pages,
    validate_analysis_citations,
    validate_native_cross_check,
    validate_stored_context_policy,
)


class TestPageEvidence(unittest.TestCase):
    def test_native_extractor_cross_check_is_schema_closed_and_finite(self):
        valid = {
            "status": "corroborated",
            "methods_compared": ["pdfplumber", "pymupdf"],
            "word_counts": {"pdfplumber": 1_000, "pymupdf": 980},
            "word_count_agreement_ratio": 0.98,
            "page_token_similarity_ratio": 0.95,
            "pairwise_page_token_similarity": [{
                "methods": ["pdfplumber", "pymupdf"],
                "page_token_similarity_ratio": 0.95,
            }],
            "minimum_similarity_required": 0.8,
            "selected_consensus_method": "pdfplumber",
        }
        self.assertEqual(
            validate_native_cross_check(valid, "pdfplumber"),
            valid,
        )

        mutations = []
        for invalid_ratio in (float("nan"), float("inf")):
            mutated = copy.deepcopy(valid)
            mutated["word_count_agreement_ratio"] = invalid_ratio
            mutations.append(mutated)
        mutated = copy.deepcopy(valid)
        mutated["status"] = "success-ish"
        mutations.append(mutated)
        mutated = copy.deepcopy(valid)
        mutated["word_counts"]["pdfplumber"] = -1
        mutations.append(mutated)
        mutated = copy.deepcopy(valid)
        mutated["unexpected_private_payload"] = "SECRET-SENTINEL"
        mutations.append(mutated)
        mutated = copy.deepcopy(valid)
        mutated["pairwise_page_token_similarity"][0][
            "page_token_similarity_ratio"
        ] = 0.7
        mutations.append(mutated)

        for mutated in mutations:
            with self.subTest(mutation=mutated):
                with self.assertRaises(SourceEvidenceError):
                    validate_native_cross_check(mutated, "pdfplumber")

    def test_title_page_author_is_source_backed_or_explicitly_absent(self):
        found = extract_title_page_author(join_marked_pages([
            "LA HISTORIA\nGuión de\nMaría López",
            "INT. HOUSE - DAY",
        ]))
        missing = extract_title_page_author(join_marked_pages([
            "UNTITLED DRAFT\nRevision 4",
            "INT. HOUSE - DAY",
        ]))

        self.assertEqual(found["author"], "María López")
        self.assertEqual(found["status"], "found")
        self.assertEqual(missing["author"], "Not found on title page")
        self.assertEqual(missing["status"], "not_found")

    def test_every_physical_page_keeps_a_deterministic_marker(self):
        text = join_marked_pages(
            [
                "TITLE PAGE screenplay by writer",
                "INT. HOUSE - DAY\nA complete scene unfolds here.",
                "EXT. STREET - NIGHT\nThe ending resolves the story.",
            ]
        )
        evidence = build_page_evidence(text, 3, "pdfplumber")

        self.assertIn("[PAGE 1]", text)
        self.assertIn("[PAGE 2]", text)
        self.assertIn("[PAGE 3]", text)
        self.assertTrue(evidence["extraction_quality"]["publication_ready"])
        self.assertEqual(
            [page["page"] for page in evidence["page_diagnostics"]],
            [1, 2, 3],
        )

    def test_missing_final_page_blocks_publication(self):
        text = join_marked_pages(
            [
                "TITLE PAGE screenplay by writer",
                "INT. HOUSE - DAY\nA complete scene unfolds here.",
            ]
        )
        evidence = build_page_evidence(text, 3, "pdfplumber")

        self.assertFalse(evidence["extraction_quality"]["publication_ready"])
        self.assertIn(
            "missing_page_markers",
            evidence["extraction_quality"]["issues"],
        )

    def test_sparse_text_from_a_large_content_stream_requires_ocr(self):
        text = join_marked_pages([
            "TITLE",
            "INT.",
            "FADE OUT.",
        ])
        signals = [
            {"content_bearing": True, "content_stream_bytes": 80, "image_count": 0},
            {"content_bearing": True, "content_stream_bytes": 4_000, "image_count": 0},
            {"content_bearing": True, "content_stream_bytes": 90, "image_count": 0},
        ]

        evidence = build_page_evidence(text, 3, "pdfplumber", signals)

        self.assertFalse(evidence["extraction_quality"]["publication_ready"])
        self.assertEqual(
            evidence["extraction_quality"]["unreadable_content_pages"],
            [2],
        )
        self.assertEqual(evidence["page_diagnostics"][0]["status"], "sparse")
        self.assertEqual(evidence["page_diagnostics"][2]["status"], "sparse")

    def test_ocr_corroborates_a_legitimate_sparse_page(self):
        text = join_marked_pages(["TITLE", "FADE OUT."])
        signals = [
            {
                "content_bearing": True,
                "content_stream_bytes": 4_000,
                "image_count": 0,
                "ocr_corroborated": True,
            },
            {
                "content_bearing": True,
                "content_stream_bytes": 3_000,
                "image_count": 0,
                "ocr_corroborated": True,
            },
        ]

        evidence = build_page_evidence(text, 2, "v9_runtime", signals)

        self.assertTrue(evidence["extraction_quality"]["publication_ready"])
        self.assertEqual(
            [page["status"] for page in evidence["page_diagnostics"]],
            ["sparse", "sparse"],
        )


class TestModelContextPolicy(unittest.TestCase):
    def test_old_195k_cutoff_no_longer_slices_sonnet_screenplays(self):
        text = "x" * 195_001
        policy = build_context_policy(text, "sonnet")

        self.assertFalse(policy["source_truncated"])
        self.assertEqual(policy["input_characters"], len(text))
        self.assertEqual(policy["genre_model"], "haiku")

    def test_long_context_promotes_genre_check_to_sonnet(self):
        text = "x" * 500_000
        policy = build_context_policy(text, "sonnet")

        self.assertEqual(policy["genre_model"], "sonnet")
        self.assertFalse(policy["source_truncated"])

    def test_haiku_only_analysis_fails_closed_above_its_safe_budget(self):
        with self.assertRaisesRegex(SourceEvidenceError, "safe budget"):
            build_context_policy("x" * 500_000, "haiku")

    def test_stored_context_policy_must_match_the_full_source(self):
        policy = build_context_policy("x" * 195_001, "sonnet")
        self.assertEqual(
            validate_stored_context_policy(
                {"_context_policy": policy},
                195_001,
                "sonnet",
            ),
            policy,
        )
        with self.assertRaisesRegex(SourceEvidenceError, "does not match"):
            validate_stored_context_policy(
                {"_context_policy": policy},
                195_002,
                "sonnet",
            )


class TestCitationEvidence(unittest.TestCase):
    def setUp(self):
        self.text = join_marked_pages(
            [
                "TITLE PAGE screenplay by writer",
                "INT. HOUSE - DAY\nThe midpoint reversal happens here.",
                "EXT. STREET - NIGHT\nThe ending resolves the story.",
            ]
        )
        self.page_evidence = build_page_evidence(
            self.text,
            3,
            "pdfplumber",
        )
        self.analysis = {
            "reader_reports": {
                "structure": {
                    "sub_scores": {
                        "midpoint": {
                            "score": 8,
                            "justification": "A strong reversal.",
                            "page_citations": [2],
                            "citation_evidence": [{
                                "page": 2,
                                "excerpt": "The midpoint reversal happens here.",
                            }],
                        }
                    }
                }
            }
        }

    def test_valid_reader_citation_is_verified(self):
        quality = validate_analysis_citations(
            self.analysis,
            self.page_evidence["page_diagnostics"],
            3,
            self.text,
        )

        self.assertEqual(quality["status"], "verified")
        self.assertEqual(quality["verified_page_numbers"], [2])
        self.assertEqual(
            quality["verification_scope"],
            "physical_page_and_exact_excerpt_location",
        )

    def test_invented_excerpt_cannot_verify_a_real_page_number(self):
        metric = self.analysis["reader_reports"]["structure"]["sub_scores"]["midpoint"]
        metric["citation_evidence"][0]["excerpt"] = "A dragon destroys the house."

        quality = validate_analysis_citations(
            self.analysis,
            self.page_evidence["page_diagnostics"],
            3,
            self.text,
        )

        self.assertEqual(quality["status"], "needs_review")
        self.assertIn("unsupported_page_citations", quality["issues"])

    def test_out_of_range_citation_blocks_publication(self):
        self.analysis["reader_reports"]["structure"]["sub_scores"]["midpoint"][
            "page_citations"
        ] = [99]
        quality = validate_analysis_citations(
            self.analysis,
            self.page_evidence["page_diagnostics"],
            3,
            self.text,
        )

        self.assertEqual(quality["status"], "needs_review")
        self.assertIn("invalid_page_citations", quality["issues"])

    def test_high_reader_score_without_citation_blocks_publication(self):
        del self.analysis["reader_reports"]["structure"]["sub_scores"]["midpoint"][
            "page_citations"
        ]
        quality = validate_analysis_citations(
            self.analysis,
            self.page_evidence["page_diagnostics"],
            3,
            self.text,
        )

        self.assertEqual(quality["status"], "needs_review")
        self.assertIn(
            "high_scores_missing_page_citations",
            quality["issues"],
        )

    def test_malformed_high_score_cannot_bypass_citation_verification(self):
        metric = self.analysis["reader_reports"]["structure"]["sub_scores"]["midpoint"]
        del metric["justification"]
        metric["page_citations"] = []
        quality = validate_analysis_citations(
            self.analysis,
            self.page_evidence["page_diagnostics"],
            3,
            self.text,
        )

        self.assertEqual(quality["status"], "needs_review")
        self.assertIn("malformed_reader_metrics", quality["issues"])
        self.assertIn("high_scores_missing_page_citations", quality["issues"])

    def test_nested_hybrid_reader_scores_require_citations(self):
        nested_analysis = {
            "_hybrid_mode": {
                "sonnet_analysis_evidence": {
                    "reader_reports": {
                        "structure": {
                            "sub_scores": {
                                "midpoint": {
                                    "score": 8,
                                    "justification": "Strong reversal.",
                                    "page_citations": [],
                                }
                            }
                        }
                    }
                }
            }
        }
        quality = validate_analysis_citations(
            nested_analysis,
            self.page_evidence["page_diagnostics"],
            3,
            self.text,
        )

        self.assertEqual(quality["status"], "needs_review")
        self.assertIn("high_scores_missing_page_citations", quality["issues"])

    def test_verified_quality_is_attached_to_analysis(self):
        metadata = {
            **self.page_evidence,
            "page_evidence_sha256": self.page_evidence["evidence_sha256"],
        }
        quality = attach_verified_citation_quality(
            self.analysis,
            metadata,
            3,
            self.text,
        )

        self.assertEqual(quality["status"], "verified")
        self.assertEqual(self.analysis["_citation_quality"], quality)


if __name__ == "__main__":
    unittest.main()
