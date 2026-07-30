# Q1: Immutable Trust Manifest

Date: 2026-07-29
Status: deployed and proven in production from main commit `706edcf`

## Producer guarantee

Every future permanent V9 result must prove:

1. which immutable PDF bytes were read;
2. which parser, prompt bundle, engine, schema, and scoring code ran;
3. every exact model request, returned model, Anthropic response ID, successful
   retry history, exhausted failed-attempt history, and whether a paid response
   was used or discarded as unusable;
4. which pipeline pass and rerun each call belonged to, plus which readers
   completed or failed and why;
5. the reader sub-scores, recomputed pillar arithmetic, raw score, penalty,
   gate inputs, adjusted score, and final verdict;
6. whether boundary reruns were unnecessary, disabled, completed, or failed,
   with the reason checked against the actual score and fixed V9 window;
7. which calibration profile was applied, without storing the private prompt;
8. whether a Haiku cold read informed full synthesis, including its normalized
   evidence and exact response link.

If any required proof is missing or changes after the manifest is sealed, the
Firestore write is rejected.

## Scope

- This contract applies to future daemon and CLI writes.
- The 23 records measured in Q0 are not changed, migrated, or assigned guessed
  provenance.
- CLI ingestion must archive the exact PDF in the canonical immutable
  `screenplays/{project}/versions/{version}.pdf` path before paid analysis
  begins.
- Every archive pointer requires a positive Storage generation number.
- Existing immutable versions are downloaded at that exact generation and
  rehashed before an idempotent retry can be reported as complete.

## Stored contract

Each future parent and immutable version includes:

- `trust_manifest`
- `trust_manifest_version`
- `analysis_schema_version`
- `prompt_version`
- `parser_version`
- `scoring_code_version`
- `analysis_provider`
- an exact `analysis_model`, not a generic tier label

The manifest contains a deterministic SHA-256 integrity seal. Its timestamp is
derived from the durable queue timestamp, so a daemon retry targets the same
project/version identity. Identical raw evidence produces the same seal; a
fresh model run correctly produces a new evidence manifest because its response
IDs and analysis may differ. A separate SHA-256 covers the complete
producer-facing analysis payload, including summaries, loglines, strengths,
weaknesses, development notes, and full reader prose.

The permanent-write gate independently recomputes reader, weighted-score,
penalty, gate, boundary median, score-spread, and majority-verdict decisions.
It also independently validates every boundary run's reader evidence and score
lineage, then verifies that the run points to the exact model responses that
produced it. A reader response that was discarded or exhausted must match the
reader explicitly declared failed; it cannot silently contradict a completed
reader. Hybrid selection records and seals both the Sonnet promotion decision
and the final Opus evidence when promotion occurs.

Large reader prose remains in the analysis itself and is not copied into the
manifest. Boundary and hybrid records retain compact arithmetic evidence plus
SHA-256 evidence links. Before either parent or immutable version is written,
the Firestore client encodes the actual document and enforces a 900,000-byte
guard, leaving safety headroom below Firestore's 1 MiB hard limit. Oversized
results are rejected before Firestore; CLI runs retain a local recovery copy
and report failure, never success.

## Production proof

Q1 changed both sides of the analysis call:

1. `llmProxy` returns the Anthropic `message.id`.
2. The daemon requires that ID before saving an analysis.

The Function and daemon were deployed in that order with Billy's approval. The
new daemon performs a free authenticated startup capability check before it
connects workers or claims queue jobs.

`W_I_L_L_2010.pdf` then completed as the production proof:

- 118 pages and 20,464 words
- all 7 model calls succeeded
- all 5 readers completed
- final PASS verdict, 4.72 adjusted score
- immutable PDF archive hash matched
- engine fingerprints and response lineage matched
- trust manifest `lemon-trust-manifest-v1`
