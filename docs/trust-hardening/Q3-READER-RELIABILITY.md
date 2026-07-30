# Q3: Five-Reader Reliability

Date: 2026-07-29

Status: implemented on `codex/q3-reader-reliability`, awaiting production approval

## Producer guarantee

A future full V9 screenplay analysis can receive a score or verdict only when:

1. all five canonical specialist readers return usable structured reports;
2. every report belongs to the requested specialist and contains score evidence;
3. an unusable or failed reader is retried independently without rerunning
   readers that already completed;
4. synthesis begins only after the complete five-reader panel is available;
5. the permanent trust manifest proves that the saved result used all five
   readers; and
6. any exhausted reader or synthesis failure stops as `needs_review`, with no
   partial score, reweighted verdict, or permanent analysis document.

## Recovery policy

Each specialist receives up to three report-level attempts. The lower-level LLM
client retains its existing transport retries inside each attempt. This gives
temporary network failures and malformed successful responses a bounded path to
recovery while preserving every paid response and failed-attempt record in
usage provenance.

Only failed specialists are retried. Completed specialists are retained.

The synthesis roundtable retains its existing three attempts. A synthesis that
still cannot produce a usable structured result moves to `needs_review`.

Budget rejection, uncertain accounting, and missing response provenance keep
their stricter existing handling. Q3 does not hide or automatically repeat a
call whose cost or identity is uncertain.

## Permanent-write boundary

New permanent full analyses use `lemon-trust-manifest-v3`. The Q3 manifest
requires:

- five expected specialist readers;
- five completed specialist readers;
- the canonical reader identities;
- no failed readers;
- exactly one used response per reader in every completed scoring run; and
- one used synthesis response after the five-reader panel.

Discarded or exhausted attempts are allowed only when the same reader later
produced the used report for that run. Their response and attempt histories
remain sealed in the model lineage.

Existing Q1 and Q2 manifests remain readable. Q3 does not rewrite or invent
reader evidence for previous records.

## Producer-facing failure state

When recovery is exhausted, the queue records:

- `status: needs_review`
- `failure_kind: reader_panel_review` or `synthesis_review`
- the completed and failed reader names
- the maximum attempts made
- concise per-reader failure history

The upload UI already surfaces `needs_review` and its reason. No partial
analysis card appears in the slate.

## Deployment boundary

Q3 changes the VPS analysis engine, daemon queue handling, browser analysis
fallback, and permanent trust contract. It is not deployed as part of the
implementation branch. Production deployment requires Billy's separate
approval after tests and a fresh local or controlled proof.
