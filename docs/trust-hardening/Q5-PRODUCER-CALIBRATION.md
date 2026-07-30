# Q5 Producer Calibration Contract

Status: implemented and verified locally on `codex/q5-producer-calibration`.
Nothing in this contract is deployed or active yet.

## Producer promise

Q5 lets Billy disagree with an AI analysis without changing the analysis that
was actually produced. A Producer Take sits beside the sealed AI result and
records:

- Billy's score and verdict
- whether Lemon would pursue the project
- whether the problems are development-fixable
- Billy's confidence
- the taste signals that moved the decision
- what the AI missed and what it got right
- optional five-pillar corrections
- whether the take is suitable as calibration evidence

Every take is bound to one exact immutable analysis version. Revising a take
creates a new assessment document. It never overwrites the prior revision.

## Authoritative data

### `producer_assessments/{assessmentId}`

Append-only canonical assessment. It contains the producer identity, revision
chain, judgment, and a snapshot of the exact analysis identity, score, verdict,
pillars, content hash, trust-manifest seal, and calibration profile version.

### `producer_assessment_heads/{producerUid}__{projectId}`

Mutable latest-revision pointer used for fast UI reads. It is not the historical
record.

### Compatibility projections

The server projects the newest canonical assessment into the legacy
`brain_verdicts` and `screenplay_feedback` collections so existing consumers
continue to work. Browser writes to all four collections are blocked.

Only the authenticated admin can submit a Producer Take through
`calibrationManager`. The Function validates the exact immutable analysis
version and writes the assessment, latest pointer, and compatibility projections
in one transaction.

## Candidate compiler

A candidate needs at least:

- four training assessments
- one different holdout assessment

The training and holdout IDs cannot overlap. Only assessments explicitly marked
for calibration can be used.

The compiler uses the approved frontier Opus model through the existing
authenticated `llmProxy`, budget reservation, settlement, and cost ledger. It
receives only training judgments and produces a structured policy through a
strict tool contract. The five specialist readers remain neutral. The policy
can affect only final studio synthesis on future analyses.

## Blind benchmark

The holdout decision replay receives:

- the candidate policy
- sealed specialist-reader reports
- raw pillar scores and gate evidence

It does not receive Billy's holdout score, verdict, or comments. Those hidden
answers are revealed only after the replay to measure:

- mean absolute score error
- exact verdict agreement
- false passes
- false recommendations

A candidate is blocked if it creates more serious false passes, creates more
serious false recommendations, increases score error beyond the small rounding
tolerance, or reduces verdict agreement.

## Publication and rollback

Candidates are immutable under
`producer_profiles/admin/versions/{candidateId}`. A passing candidate can be
published as the active profile. Publishing updates only the pointer used by
future analyses. It never rescores existing projects.

Every activation and rollback creates an immutable receipt under
`producer_profiles/admin/publications/{publicationId}` with:

- action
- candidate and previous version
- benchmark pass state
- prompt hash
- assessment-set hash
- compiler model
- publishing admin
- timestamp

A failing candidate cannot be published even if a client attempts to bypass the
UI.

## Analysis provenance

Future calibrated analyses use trust-manifest v4 and seal:

- exact calibration profile version
- exact prompt SHA-256
- exact source-assessment-set SHA-256
- exact compiler model

The VPS validates those fields before any paid analysis work. A malformed or
tampered profile falls back to neutral analysis and records the reason. Legacy
uncalibrated and v1-v3 trusted analyses remain readable.

## Safety state at local completion

- No candidate compiler or benchmark model call was made.
- No profile was activated.
- No production service was deployed.
- Existing AI scores and verdicts were not changed.
- Existing Discovery and dashboard behavior remains green.

## Deployment and activation sequence

1. Billy reviews the local UI and approves Q5.
2. Coordinate deployment of hosting, `calibrationManager`, Firestore rules, and
   the VPS daemon.
3. Billy publishes at least five diverse Producer Takes.
4. Billy separately approves the paid candidate build and blind benchmark.
5. Billy reviews the benchmark and policy.
6. Billy separately approves activation. Rollback remains available after that.
