# Q2: Complete Source and Page Evidence

Date: 2026-07-29

Status: implemented on `codex/q2-parser-evidence`, not deployed

## Producer guarantee

A future screenplay can receive a final verdict only when the system can prove:

1. every physical PDF page survived extraction with its page identity intact;
2. the opening, body, and ending contain enough readable evidence;
3. the complete extracted screenplay was sent to the selected model;
4. no hidden character cutoff removed late-act material;
5. every cited page exists and contains extracted evidence;
6. every reader sub-score of 7 or higher includes a page citation;
7. the permanent record seals page, context, and citation evidence against
   later alteration.

If one of those conditions fails, the queue moves to `needs_review`. It does
not publish a score or verdict and it does not retry the same deterministic
problem.

## Page-preserving extraction

All native extractors and OCR now emit deterministic markers:

```text
[PAGE 1]
...

[PAGE 2]
...
```

Blank pages keep their markers. Each page records:

- physical page number
- readable, sparse, or empty status
- character count
- word count

Publication requires at least 80 percent readable pages overall, plus at least
70 percent readable coverage across the first and final ten pages. Native PDFs
also record word-count agreement across pdfplumber, PyMuPDF, and PyPDF2. If
two viable native extractors disagree by more than 35 percent, the screenplay
moves to `needs_review`; extractor order can never decide which contradictory
text receives a verdict. OCR is the fallback when no native method produces
publication-ready evidence.

## Complete-source context policy

The old 195,000-character slice is removed from both the VPS pipeline and the
browser analysis path.

Q2 uses pinned model capabilities and conservative input budgets:

| Model | Documented context | Q2 safe screenplay input |
|---|---:|---:|
| Haiku 4.5 | 200,000 tokens | 150,000 tokens |
| Sonnet 4.6 | 1,000,000 tokens | 800,000 tokens |
| Opus 4.7 | 1,000,000 tokens | 800,000 tokens |

The estimate assumes only three characters per token and keeps the remaining
window for prompts, thinking, tools, and output. A screenplay too large for
Haiku triage can proceed directly to complete Sonnet analysis. A screenplay
too large for its selected primary model stops before a paid call.

## Citation gate

Q2 validates `page_citations` recursively across the complete saved analysis.
A citation is rejected when it:

- is not an integer;
- falls outside the physical PDF page range;
- points to a missing or empty extracted page.

Reader sub-scores of 7 or higher must have at least one page citation. The
verified page list, invalid citation list, missing-required-citation list, and
evidence hash are retained with the analysis.

## Trust manifest compatibility

New records use `lemon-trust-manifest-v2` and seal:

- page extraction evidence;
- context-window policy and proof of zero truncation;
- citation quality and evidence hash;
- the existing Q1 identity, model, reader, score, cost, and response lineage.

Existing `lemon-trust-manifest-v1` records remain readable and valid. Q2 does
not invent missing evidence for Q1 records and does not rewrite the current
slate.

The llmProxy response-provenance capability remains
`lemon-trust-manifest-v1`. That capability proves exact model response
identity. The permanent Firestore record is independently upgraded to the Q2
manifest.

## Deployment boundary

Q2 changes the VPS daemon and application code. No production deployment is
part of the Q2 implementation branch. A later approved deployment must update
the daemon and hosting together so every active entry path uses the same
complete-source standard.
