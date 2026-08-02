# Q6 Intake MVP Closure

Status: merged and deployed hosting-only on `main` at `d9b7beb`.

## Producer promise

Q6 turns the existing analysis intake machinery into a clear studio workflow.
An admin can add screenplay PDFs, resolve exact duplicates and possible
revisions, choose the reading route, approve the estimated batch, follow live
progress, and open a completed project in Discovery.

Q6 does not rebuild or alter the analysis engine. It reconnects the existing
Storage upload, queue Function, Firestore job, and VPS daemon path.

## Experience

- `/intake` is lazy-loaded, error-bounded, and admin-only.
- The Discovery header adds Intake for admins and hides it from readers.
- Hybrid is the Intake default because it applies complete first-pass coverage
  to the funnel and reserves deeper work for stronger material.
- Exact-byte duplicates stop before analysis.
- Same-title projects require an explicit revision or separate-project choice.
- Adding a file starts no model call.
- Starting analysis requires a final dialog showing the project count, model,
  and cost estimate. Escape and cancel are safe no-ops.
- The live docket distinguishes pending, working, complete, failed, skipped,
  and needs-review outcomes using the existing queue state.
- New completed jobs preserve the authoritative Firestore project ID so the
  producer can open the finished analysis directly.

## Scope boundary

Q6 changes the React application only. It does not modify or deploy:

- Cloud Functions
- Firestore or Storage rules
- the VPS daemon or execution pipeline
- analysis prompts or model routing
- calibration state

No paid model calls are required for local review or automated verification.

## Verification contract

- `/intake` follows the existing lazy route and admin AuthGate pattern.
- Discovery keeps the Intake navigation hidden from reader accounts.
- the existing Settings upload presentation remains the default
- Intake defaults to Hybrid without changing the Settings default
- the docket has an honest empty state
- a completed job opens the authoritative Discovery project route
- the final confirmation prevents upload until explicitly confirmed
- Escape closes the confirmation without starting analysis
- full app build, lint, and regression suite remain green

## Deployment checkpoint

Q6 passed local review and was deployed hosting-only with Billy's explicit
approval. The ingest Functions, Firestore rules, and VPS daemon were unchanged
and were not redeployed for Q6.
