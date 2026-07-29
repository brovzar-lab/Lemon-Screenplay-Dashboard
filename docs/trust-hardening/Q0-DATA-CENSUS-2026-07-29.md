# Q0 Production Data Census

Date: 2026-07-29

Method: read-only Firebase Admin queries

Collection: `uploaded_analyses`

The census script prints aggregate metadata only. It does not print screenplay
titles, filenames, loglines, notes, reader prose, or document identifiers.

Reproduction command:

```bash
node scripts/q0-trust-census.mjs
```

## Project inventory

| Measure | Count |
|---|---:|
| Total projects | 23 |
| V8 Archaeology | 16 |
| V9 Archaeology | 7 |
| Soft-deleted | 0 |
| Quarantined | 0 |

All 23 parent documents share one top-level shape, but their nested `analysis`
objects have six distinct shapes.

## Immutable version inventory

| Measure | Count |
|---|---:|
| Projects with immutable versions | 0 |
| Projects without immutable versions | 23 |
| Total immutable version documents | 0 |

The repository now contains immutable-version write logic and tests, but the
current production slate predates those writes. Existing projects therefore do
not yet have recoverable immutable analysis snapshots.

Q1 must not manufacture history or overwrite these parents. It should establish
the canonical manifest for new work first. Any migration of existing projects
must be separately approved, non-destructive, and create an explicit imported
baseline version.

## Provenance coverage

| Field or guarantee | Present |
|---|---:|
| Analysis object | 23 of 23 |
| Ingest job ID | 23 of 23 |
| Valid SHA-256 content hash | 0 of 23 |
| Verified content identity | 0 of 23 |
| PDF storage pointer | 0 of 23 |
| Prompt version | 0 of 23 |
| Parser version | 0 of 23 |
| Applied calibration provenance | 0 of 23 |

This means the current parent documents cannot independently prove which exact
PDF bytes, parser, prompt, or calibration profile produced their judgment.

## Score lineage

| Measure | Count |
|---|---:|
| Raw weighted score | 23 of 23 |
| Adjusted weighted score | 6 of 23 |
| Raw score differs from adjusted score | 6 |
| Critical-failure penalty record | 6 of 23 |
| Non-empty verdict-adjustment trail | 6 of 23 |

Every project with an adjusted score has a meaningful difference between the
raw and adjusted values. This confirms that displaying and ranking only the raw
score can materially misrepresent the judgment used for the final verdict.

## Reader evidence

| Measure | Count |
|---|---:|
| Documents containing reader reports | 7 of 23 |
| Reader reports containing all five readers | 7 of 7 |
| Explicitly complete analysis quality | 2 |
| Explicitly partial analysis quality | 0 |
| Missing analysis-quality status | 21 |
| Documents recording failed readers | 0 |

The seven V9 projects retain all five reader reports. Only two parent documents
explicitly declare their quality status, so absence of a partial flag cannot be
treated as proof that the other 21 analyses were complete.

## Stability and completeness

| Measure | Count |
|---|---:|
| Boundary rerun triggered | 3 |
| No boundary rerun record | 20 |
| Explicitly truncated | 0 |
| No truncation record | 17 |

Stored boundary score spread:

- Minimum: 0.42
- Average: 0.55
- Maximum: 0.80

Only three projects contain measured stability evidence. A missing boundary
record may mean the script was not near a boundary or that it predates the
feature. The current data does not distinguish those cases.

Six projects contain an explicit non-truncated record. Seventeen predate the
record, so their completeness cannot be proven from stored metadata.

## Q1 implications

Q1 should introduce the manifest and validation contract for future writes
without altering the 23 current parent records. The required minimum fields are:

1. Exact PDF content hash and immutable PDF pointer
2. Stable project and version identity
3. Parser name and version
4. Prompt version and prompt hash
5. Exact requested and returned model IDs
6. Analysis schema and scoring-code versions
7. Calibration profile identity
8. Reader completion and failure details
9. Raw score, penalty, adjusted score, gates, and final verdict
10. Boundary-run provenance and complete retry history

Existing projects should later receive an explicit legacy provenance status
rather than guessed values.
