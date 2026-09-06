# Cosquillitas bounded pilot, 2026-09-06

## Outcome: BLOCK, not a production qualification

The separately authorized private pilot actually ran, against release
`a7bd7cddfdb20bbe2d354d983558423af2217f1e`, with a $5 total ceiling and
three-call maximum. One provider request succeeded. The new reader then
rejected the successful transport's accounting format before saving a receipt
or draft checkpoint. No correction or independent model-review call ran.
No deployment, worker activation, queue/requeue, or report publication occurred.
The other screenplays remain locked. Do not automatically rerun this pilot.

The response was retained privately and independently compared with the approved
audit. It is substantial coverage, but it repeats material existing-evidence
and ending-order defects. It must not be presented as Ready. The complete
bounded reader/reviewer path has therefore NOT been qualified.

## Verified execution and accounting

| Evidence | Value |
| --- | --- |
| Engine | `coverage-v1.2-bounded-1`, not V9 or the former 17-call loop |
| Isolated VPS checkout | `/opt/lemon-bounded-pilot-a7bd7cd` |
| Paid output | `/opt/lemon-v12-results/cosquillitas-bounded-a7bd7cd` |
| Unit | `lemon-bounded-cosquillitas-a7bd7cd.service`, terminal exit 2, `Restart=no` |
| Invocation | `858d22fbd68d49d49f4bde20539e08c6` |
| Source SHA-256 | `8e46bdc2fda2cdb3b7ee8bc42574de9e70047174214c632c3047634d4c537276` |
| Approved audit ledger SHA-256 | `1e4cdb8e37b8a0ab02c51f3f2d5a0d2a016283461cc65c45d95a0b041b96f04d` |
| First request fingerprint | `b273963c85f5ae0d7c4b7a7a651b7a263a2fef47ce8e8e50fd25f26e20eede58` |
| Driver SHA-256 | `f5f695ea9530aa854c539dfe98d42aed3254412b85b5532ac9fe65bf5890352d` |
| Local reservation | $1.094012, still retained; NOT the actual charge |
| Matching authoritative server charge | $0.356658, one settled call |
| Server active reservations after settlement | None; reserved amount zero |
| Python suite on exact remote candidate | 840 tests PASS before dispatch |
| Final dry run | Zero real calls; exact source, parser, ledger and request matched |

The deployed proxy was `llmproxy-00022-buh`. Its exact source archive generation
`1788191367174050` has `maxRetries: 0` in the client actually imported by the
proxy. The client also requested one transport attempt. Cloud Run recorded
one HTTP 200 request at `2026-09-06T18:38:32.330397Z`, lasting
`241.543878061s`, trace `4673af95cf2c6d6a885ade5c297307b5`.

Read-only server accounting evidence is
`system/llm-budget-2026-09-06/reservations/46c261a3-c353-4b68-b9e7-8c74bc63f05c`:
created `18:38:34.244Z`, settled `18:42:34.076Z`, model `claude-sonnet-4-6`,
queue job null. Usage: 362 input tokens, 52,867 cache-creation tokens,
zero cache-read tokens and 10,488 output tokens. The exact token estimate is
356,657,250 nano-USD, rounded up by 750 nano-USD to 356,658 micro-USD.

Attribution is supported by the unique request/reservation in the execution
interval: all ten daily reservation records were inspected, the preceding
request was hours earlier, and the daily count reconciled to ten. The ordinary
server reservation does not contain the client request fingerprint or provider
response ID. This is NOT a reconstructed cryptographically bound local receipt.
The original local checkpoint was not edited or falsely marked settled.

## Earliest failure and the test gap

At this release, `execution/coverage_reader.py:177-189` requires
`calls[0].usage_accounting_state == exact_settled_provider_usage` and a flat
`calls[0].actual_cost_microusd`. Real successful `ingest_v9.call_llm` returns
the per-call amount inside `calls[0].usage` and does not attach that marker
(`execution/ingest_v9.py:6692-6707`). The reader raises
`CoverageUnresolvedSpendError: Malformed settlement; reservation retained and
spending stopped` before saving the successful tuple.

The reader tests mocked transport with the older flat `settled_usage` fixture.
They tested an internally consistent imitation, not this real adapter boundary.
The earlier independent review also missed the mismatch. All 840 tests passing
did not prove that the new reader accepted its real transport's successful bill.

A private no-network reproduction now invokes the real `call_llm`, mocking
only its HTTP response, and confirms that the reader rejects its valid nested
usage. It also verifies the untouched pilot checkpoint hash and reservation.

```sh
PYTHONPATH=. .venv/bin/python benchmark-artifacts/cosquillitas-bounded-a7bd7cd/reproduce_receipt_mismatch.py
```

Result: `REPRODUCED`, network calls zero, checkpoint integrity PASS. This is a
historical diagnostic at `a7bd7cd`, not a passing regression for a fix. Its
assertion intentionally expects the old rejection and no longer passes on the
repaired source. Use `execution/test_coverage_reader.py` for repair regressions.

## Draft-quality comparison

An independent read-only reviewer inspected the complete saved tool output
against the complete approved audit. The primary agent also checked relevant
printed pages visually. No screenplay text is copied here.

- The draft is readable, substantial Spanish coverage, with a qualitative
  CONSIDER verdict and medium confidence. It contains no numeric screenplay
  score. Several prior counting and invented-action errors did not recur.
- It repeats an unsupported absence-of-setup claim across multiple report
  sections, ignoring already approved existing evidence.
- Its synopsis/ending puts a character reconciliation after events that follow
  it in the screenplay, and compresses the multi-stage climax.
- It presents some creative/commercial judgments as objective certainties.
- Smaller citation-relevance, counting and draft-note omissions remain.

This was a first draft, not the output of the independent review stage. It does
not establish whether that stage would have caught the defects. The bounded
design does not automatically purchase factual rewrites; detected factual
issues should remain visible as Needs Review, not silently become Ready.

## Smallest next step, no new spending

1. Fix the shared receipt adapter to accept actual nested transport accounting,
   compare every token/cost counter with its aggregate, and continue rejecting
   uncertain or contradictory usage. Keep support for valid older receipts.
2. Test the reader through real `call_llm` with only HTTP mocked: normal
   two-call completion, settled output-contract failure, no duplicate spending,
   zero-call replay, and malformed/uncertain bills remaining blocked.
3. Preserve the full returned tuple, especially usage, before another local
   validation can discard it. Content-only debug capture is insufficient.
4. Plan explicit, evidence-bound recovery of this already-paid draft and bill.
   Do not clear or fabricate a receipt, repurchase the reading, or hide its
   cost behind a new checkpoint namespace. A changed implementation binding
   cannot automatically resume this frozen store.

Only after the no-spend correction and reviewed recovery should a further
bounded review call be considered. No spending or production authorization is
implied by this report. The five-script and twenty-script gates remain closed.

Private evidence stays Git-ignored under
`benchmark-artifacts/cosquillitas-bounded-a7bd7cd/`: the original driver,
downloaded results, read-only server settlement snapshot and reproduction.

## Subsequent no-spend repair

The real-transport receipt mismatch has been repaired locally. Nested per-call
usage must match every aggregate token/cost counter and pass the existing
adapter's routing, exact-cost and rounding checks. Older explicit flat receipts
remain supported. Uncertain, malformed or contradictory accounting still
retains the reservation and stops further spending.

The reader now saves the entire transport return (including full usage) or
exception usage/rejected output in a hash-bound `transport_<stage>` checkpoint
before inspecting it. This is diagnostic evidence, not an accepted receipt.
Capture/write failures retain the spending lock. There is no automatic receipt
migration, budget clearing, or changed-binding replay.

Seven new no-network regressions exercise the real `call_llm` adapter with only
HTTP simulated: two-call completion and zero-call replay; failed first output
settlement/no repurchase; malformed bills/timeout with draft preservation;
visible factual issues; interrupted durable capture; and settled truncated
review with preserved draft and failure evidence. The original mocked-transport
tests also remain, including legacy flat receipts and tampering checks.
The seventh test deliberately corrupts the real adapter's returned duplicate
billing fields at the public transport boundary; the saved evidence survives,
but the bill cannot settle. Timeout evidence retains request fingerprints,
attempt history and the explicit no-spend marker when provided.

The private draft was recovered separately as
`benchmark-artifacts/cosquillitas-bounded-a7bd7cd/recovered-review-draft.json`.
Its coverage content is identical to the saved tool input, with explicit
Needs Review reasons outside it, `coverage_unscored`, `rankable: false`, and
`replay_eligible: false`. The original raw-response and budget file hashes still
match the preserved evidence. Independent review confirms that timestamps and
model agreement cannot reconstruct the missing request/response receipt link.
No receipt was fabricated, and the original paid checkpoint remains locked.

This repair does not establish the quality of an independent model review or
qualify the product for unattended ingestion. Any future evaluation should
reuse the existing draft as a review input rather than buying its reading
again, with an explicit accounting/release binding and separate authorization.

### Final no-spend verification

- `npm run test:python`: 847 passing, including 23 bounded-reader tests.
- Desktop ingest Python suite: 21 passing.
- `npm run test:run`: 1,112 passing, 148 files.
- `npm run build`: TypeScript and Vite PASS; existing chunk-size warning only.
- Original paid-artifact hashes and recovered-draft equality: PASS.
- Model calls, new inference spend, deployments and production mutations: zero.

### Standards review

PASS. No documented-standard violations or remaining material smell concerns.
The small repeated counter predicate was consolidated. Review was read-only.

### Specification review

PASS. Initial review found missing duplicate-cost comparisons and incomplete
timeout evidence. Both were reproduced with failing tests and fixed before
the final suite. No remaining spec blocker or scope creep was found. This
approval covers the local repair, not live qualification or another paid call.
